import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, limit, getDocs, doc, setDoc, serverTimestamp, getDoc, addDoc, where } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import { readFileSync } from "fs";
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf-8'));

// Initialize Firebase Admin-like on server
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Evolution API Webhook Endpoint
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    const { event, instance, data } = req.body;
    console.log(`Received Webhook: ${event} from instance ${instance}`);

    if (event === "messages.upsert" && !data.key.fromMe) {
      const remoteJid = data.key.remoteJid;
      const messageContent = data.message?.conversation || data.message?.extendedTextMessage?.text;

      if (messageContent && typeof messageContent === 'string' && messageContent.trim()) {
        try {
          // 1. Find Instance to get active Agent
          // In a real multi-user app, we'd query whatsapp_instances by instanceName
          const instancesSnap = await getDocs(query(collection(db, 'whatsapp_instances')));
          const instanceDoc = instancesSnap.docs.find(d => d.data().instanceName === instance);
          
          if (!instanceDoc) {
            console.error(`Instance ${instance} not found in Firestore`);
            return res.status(404).send("Instance not found");
          }

          const instanceData = instanceDoc.data();
          let systemPrompt = "You are OmniChat AI, a helpful assistant.";
          let useRAG = true;

          // 2. Load Agent config if linked
          if (instanceData.agentId) {
            const agentSnap = await getDoc(doc(db, 'agents', instanceData.agentId));
            if (agentSnap.exists()) {
              const agentData = agentSnap.data();
              systemPrompt = agentData.systemPrompt;
              useRAG = agentData.useRAG;
            }
          }

          // 3. Fetch Knowledge for RAG if enabled
          let context = "";
          if (useRAG) {
            const knowledgeRef = collection(db, 'knowledge');
            const q = query(knowledgeRef, where('userId', '==', instanceData.userId), limit(10));
            const knowledgeSnap = await getDocs(q);
            context = knowledgeSnap.docs.map(doc => `[${doc.data().title}]: ${doc.data().content}`).join('\n\n');
          }

          // 4. Generate Answer
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const fullInstruction = `
            ${systemPrompt}
            ${useRAG ? `\n\nUSE THIS CONTEXT IF RELEVANT:\n${context}` : ''}
            
            Keep answers concise for WhatsApp.
          `;

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: messageContent }] }],
            systemInstruction: fullInstruction
          });

          const aiResponse = result.response.text();

          // 5. Sync to Firestore (Store conversation)
          const chatId = remoteJid.replace(/[^a-zA-Z0-9]/g, '_');
          const chatRef = doc(db, 'chats', chatId);
          await setDoc(chatRef, {
            userId: instanceData.userId,
            title: remoteJid.split('@')[0],
            lastMessage: aiResponse,
            updatedAt: serverTimestamp(),
            whatsappNumber: remoteJid
          }, { merge: true });

          const messagesRef = collection(db, 'chats', chatId, 'messages');
          // Add user message
          await addDoc(messagesRef, {
            content: messageContent,
            role: 'user',
            createdAt: serverTimestamp()
          });
          // Add AI response
          await addDoc(messagesRef, {
            content: aiResponse,
            role: 'model',
            createdAt: serverTimestamp()
          });

          // 6. Send Back to WhatsApp
          const instanceKey = instanceData.apikey;
          const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

          await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instanceKey as string
            },
            body: JSON.stringify({
              number: remoteJid.split('@')[0],
              text: aiResponse,
              delay: 1000
            })
          });

          console.log(`Responded to ${remoteJid} using Agent: ${instanceData.agentId || 'Default'}`);
        } catch (err) {
          console.error("Webhook processing error:", err);
        }
      }
    }

    res.status(200).send("OK");
  });

  // Proxy to Evolution API to hide Global API Key
  app.post("/api/whatsapp/create-instance", async (req, res) => {
    try {
      const { instanceName, userId } = req.body;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;
      const globalKey = process.env.EVOLUTION_GLOBAL_API_KEY;

      console.log(`Creating instance: ${instanceName} for user: ${userId}`);

      const host = req.get('host');
      const protocol = req.protocol === 'http' && host.includes('localhost') ? 'http' : 'https';
      const fallbackUrl = `${protocol}://${host}/api/webhooks/whatsapp`;
      const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/webhooks/whatsapp` : fallbackUrl;

      console.log(`Creating instance: ${instanceName} with webhook: ${webhookUrl}`);

      const response = await fetch(`${evolutionUrl.replace(/\/$/, '')}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': globalKey as string
        },
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          webhook: {
            enabled: true,
            url: webhookUrl,
            events: ["MESSAGES_UPSERT"]
          }
        })
      });
      const data = await response.json();
      console.log("Evolution API Response:", data);
      res.json(data);
    } catch (err) {
      console.error("Instance creation proxy error:", err);
      res.status(500).json({ error: "Failed to create instance", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Proxy to Evolution API to connect (Get QR Code)
  app.get("/api/whatsapp/connect/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const instanceKey = req.headers.instancekey;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

      const response = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': instanceKey as string }
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Connect proxy error:", err);
      res.status(500).json({ error: "Failed to connect instance" });
    }
  });

  // Proxy to Evolution API to fetch instance status
  app.get("/api/whatsapp/status/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const instanceKey = req.headers.instancekey;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

      const response = await fetch(`${evolutionUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
        headers: { 'apikey': instanceKey as string }
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Status fetch proxy error:", err);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  // Proxy to Evolution API to logout
  app.delete("/api/whatsapp/logout/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const instanceKey = req.headers.instancekey;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

      if (!instanceKey || !evolutionUrl) {
        console.error("Missing instanceKey or evolutionUrl for logout");
        return res.status(400).json({ error: "Configuração incompleta" });
      }

      console.log(`Logging out instance: ${instanceName}`);

      const response = await fetch(`${evolutionUrl.replace(/\/$/, '')}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': instanceKey as string }
      });
      
      const data = await response.json();
      console.log("Logout response:", data);
      res.json(data);
    } catch (err) {
      console.error("Logout proxy error:", err);
      res.status(500).json({ error: "Failed to logout instance", details: String(err) });
    }
  });

  app.delete("/api/whatsapp/delete-instance/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const globalKey = process.env.EVOLUTION_GLOBAL_API_KEY;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

      if (!globalKey) {
        console.error("EVOLUTION_GLOBAL_API_KEY is not set");
        return res.status(500).json({ error: "Chave global da API não configurada no servidor." });
      }

      const url = `${evolutionUrl.replace(/\/$/, '')}/instance/delete/${instanceName}`;
      console.log(`Sending DELETE request to Evolution API: ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'apikey': globalKey as string }
      });

      const responseText = await response.text();
      console.log(`Evolution API Delete response (${response.status}):`, responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText };
      }

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: "Falha na Evolution API ao excluir instância", 
          details: data.message || responseText 
        });
      }

      res.json(data);
    } catch (err) {
      console.error("Delete instance proxy error:", err);
      res.status(500).json({ error: "Internal server error during instance deletion", details: String(err) });
    }
  });

  // Proxy to Evolution API to fetch connection state
  app.get("/api/whatsapp/connection-state/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const instanceKey = req.headers.instancekey;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

      const response = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': instanceKey as string }
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Connection state fetch proxy error:", err);
      res.status(500).json({ error: "Failed to fetch connection state" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
