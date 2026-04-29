import express from "express";
import path from "path";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, limit, getDocs, doc, setDoc, serverTimestamp, getDoc, addDoc, where, updateDoc } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix Vercel loading of the firebase config
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

// Initialize Firebase Admin-like on server
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const app = express();

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
          let agentData: any = {
            systemPrompt: "You are OmniChat AI, a helpful assistant.",
            useRAG: true,
            responseDelayMs: 0,
            useTyping: true,
            callOtherAgents: false
          };

          // 2. Load basic Agent config if linked
          if (instanceData.agentId) {
            const agentSnap = await getDoc(doc(db, 'agents', instanceData.agentId));
            if (agentSnap.exists()) {
               agentData = { ...agentData, ...agentSnap.data() };
            }
          }

          // Fetch Knowledge for RAG if enabled
          let context = "";
          if (agentData.useRAG) {
            const knowledgeRef = collection(db, 'knowledge');
            const q = query(knowledgeRef, where('userId', '==', instanceData.userId), limit(10));
            const knowledgeSnap = await getDocs(q);
            context = knowledgeSnap.docs.map(doc => `[${doc.data().title}]: ${doc.data().content}`).join('\n\n');
          }

          // Setup Evolution API Constants
          const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;
          const instanceKey = instanceData.apikey;
          const targetNumber = remoteJid.split('@')[0];

          // 4. Save User Message to Firestore
          const chatId = remoteJid.replace(/[^a-zA-Z0-9]/g, '_');
          const chatRef = doc(db, 'chats', chatId);
          const messagesRef = collection(db, 'chats', chatId, 'messages');
          
          await setDoc(chatRef, {
            userId: instanceData.userId,
            title: targetNumber,
            lastMessage: messageContent,
            updatedAt: serverTimestamp(),
            whatsappNumber: remoteJid
          }, { merge: true });

          await addDoc(messagesRef, {
            content: messageContent,
            role: 'user',
            createdAt: serverTimestamp()
          });

          // Simulate Typing
          if (agentData.useTyping) {
            const delayInMs = agentData.responseDelayMs ? parseInt(agentData.responseDelayMs) : 2000;
            await fetch(`${evolutionUrl}/message/sendPresence/${instance}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': instanceKey as string },
              body: JSON.stringify({ number: targetNumber, delay: delayInMs < 1000 ? 2000 : delayInMs, presence: "composing" })
            }).catch(e => console.error("Presence err:", e));
          }

          // Build Tools if Agent Routing is allowed
          let toolsDefinition: any[] = [];
          let otherAgentsList: any[] = [];
          if (agentData.callOtherAgents) {
            const allAgentsSnap = await getDocs(query(collection(db, 'agents'), where('userId', '==', instanceData.userId)));
            otherAgentsList = allAgentsSnap.docs.filter(d => d.id !== instanceData.agentId).map(d => ({id: d.id, ...d.data()}));
            
            if (otherAgentsList.length > 0) {
                 toolsDefinition = [{
                   functionDeclarations: otherAgentsList.map(ag => ({
                     name: `ask_specialist_${ag.id}`,
                     description: `Call this to ask specialist: ${ag.name}. Behavior: ${(ag.systemPrompt || '').substring(0, 100)}.`,
                     parameters: {
                       type: 'OBJECT',
                       properties: { instruction: { type: 'STRING', description: 'Question/task for the specialist.' } },
                       required: ['instruction']
                     }
                   }))
                 }];
            }
          }

          // Determine System Prompt
          const fullInstruction = `
            ${agentData.systemPrompt}
            ${agentData.useRAG && context ? `\n\nUSE THIS CONTEXT:\n${context}` : ''}
            
            Keep answers conversational and suitable for WhatsApp.
          `;

          const generateContentConfig: any = { systemInstruction: fullInstruction };
          if (toolsDefinition.length > 0) {
            generateContentConfig.tools = toolsDefinition;
          }

          let modelInputs = [{ role: 'user', parts: [{ text: messageContent }] }];
          let aiResponse = "";

          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: modelInputs,
            config: generateContentConfig
          });

          if (result.functionCalls && result.functionCalls.length > 0) {
            // Master Agent wants to call a sub-agent
            const call = result.functionCalls[0];
            const calledAgentId = call.name.replace('ask_specialist_', '');
            const instruction = (call.args as any).instruction;
            
            const subAgent = otherAgentsList.find(a => a.id === calledAgentId);
            if (subAgent) {
               const subAgentInstruction = `
                 ${subAgent.systemPrompt}
                 ${subAgent.useRAG && context ? `\n\nCONTEXT:\n${context}` : ''}
               `;
               const subResult = await ai.models.generateContent({
                 model: "gemini-2.5-flash",
                 contents: [{ role: 'user', parts: [{ text: instruction }] }],
                 config: { systemInstruction: subAgentInstruction }
               });
               
               // In a simpler setup, the sub-agent's response is the final response. 
               // Or we return it to the Master. Let's just use it as the final response to save time/tokens.
               aiResponse = subResult.text || "Sub-agent failed to respond.";
               // To make it clear in UI
               aiResponse = `*[${subAgent.name}]* \n\n` + aiResponse;
            } else {
               aiResponse = "I tried to consult a specialist but couldn't find them.";
            }

          } else {
            // Normal response
            aiResponse = result.text || "";
          }

          // Apply Delay
          if (agentData.responseDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, parseInt(agentData.responseDelayMs)));
          }

          // 6. Save AI Response
          await updateDoc(chatRef, {
            lastMessage: aiResponse,
            updatedAt: serverTimestamp()
          });
          
          await addDoc(messagesRef, {
            content: aiResponse,
            role: 'model',
            createdAt: serverTimestamp()
          });

          // 7. Send Back to WhatsApp
          await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instanceKey as string
            },
            body: JSON.stringify({
              number: targetNumber,
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
      const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/webhooks/whatsapp?userId=${userId}` : `${fallbackUrl}?userId=${userId}`;

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

  app.post("/api/whatsapp/send-message/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      const { number, text } = req.body;
      const instanceKey = req.headers.instancekey;
      const evolutionUrl = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL;

      const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instanceKey as string
        },
        body: JSON.stringify({ number, text })
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Failed to send message:", err);
      res.status(500).json({ error: "Failed to send message" });
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

export default app;

async function startServer() {
  const PORT = 3000;
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const viteModule = await import(/* @vite-ignore */ "vite");
    const vite = await viteModule.createServer({
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

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const currentFileURL = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : '';
  if (process.argv[1] === currentFileURL || typeof __filename !== 'undefined' && process.argv[1] === __filename) {
    startServer();
  }
}
