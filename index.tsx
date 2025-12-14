import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// --- Global Declarations ---
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// --- Types & Interfaces ---
type Mode = "chat" | "imagine" | "live" | "motion";
type Persona = "general" | "dl_tutor";

interface Message {
  id: string;
  role: "user" | "model";
  text?: string;
  image?: string; // base64
  isThinking?: boolean;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  persona: Persona;
}

// --- Icons ---
const Icons = {
  Chat: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
  Image: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
  Video: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect x="2" y="6" width="14" height="12" rx="2" ry="2"></rect></svg>,
  Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Loader: () => <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Book: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

// --- Helper Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// --- Components ---

// 1. Sidebar
const Sidebar = ({ activeMode, setMode }: { activeMode: Mode, setMode: (m: Mode) => void }) => {
  const menuItems: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "Chat", icon: <Icons.Chat /> },
    { id: "imagine", label: "Imagine", icon: <Icons.Image /> },
    { id: "live", label: "Live", icon: <Icons.Mic /> },
    { id: "motion", label: "Motion", icon: <Icons.Video /> },
  ];

  return (
    <div style={{
      width: "240px",
      minWidth: "240px",
      backgroundColor: "var(--sidebar-bg)",
      borderRight: "1px solid var(--border-color)",
      display: "flex",
      flexDirection: "column",
      padding: "20px",
      zIndex: 10
    }}>
      <div style={{ marginBottom: "40px", display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}></div>
        <h1 style={{ fontSize: "18px", fontWeight: "600", margin: 0, letterSpacing: "-0.5px" }}>DL App</h1>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeMode === item.id ? "var(--accent-color)" : "transparent",
              color: activeMode === item.id ? "white" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "left",
              fontSize: "14px",
              fontWeight: "500",
              outline: "none"
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      
      <div style={{ marginTop: "auto", fontSize: "12px", color: "var(--text-secondary)", opacity: 0.6 }}>
        Powered by Gemini 2.5
      </div>
    </div>
  );
};

// 2. Chat View
const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "model", text: "Hello! I'm Gemini. Select a persona below to get started." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{data: string, mimeType: string} | null>(null);
  const [persona, setPersona] = useState<Persona>("general");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await blobToBase64(file);
      setAttachment({ data: base64, mimeType: file.type });
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: "user", 
      text: input, 
      image: attachment?.data 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = persona === "dl_tutor" 
        ? "You are an expert AI tutor specializing in Deep Learning. You strictly follow the teaching style, philosophy, and technical stack of 'Deep Learning with Python, 3rd Edition' by François Chollet. You prefer Keras 3 (multi-backend), JAX/TensorFlow/PyTorch, and focus on modern best practices like the Functional API and subclassing."
        : "You are a helpful AI assistant.";

      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: { systemInstruction }
      });

      // Replay history for context
      // Note: In a real app we'd maintain chat.history properly. For simplicity here we send history or just the new message if stateless.
      // We'll treat this as a single turn with history for simplicity of the "Playground" nature, or just send the last message.
      // To keep it simple and robust, we will just send the new message with the context of the session handled by the SDK if we reused the chat object,
      // but here we recreate it. Let's just send the message.
      
      const contentParts: any[] = [];
      if (userMsg.image) {
        contentParts.push({ inlineData: { mimeType: 'image/jpeg', data: userMsg.image } });
      }
      if (userMsg.text) {
        contentParts.push({ text: userMsg.text });
      }

      const resultStream = await chat.sendMessageStream({
        message: contentParts
      });

      let fullText = "";
      const modelMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, { id: modelMsgId, role: "model", text: "", isThinking: true }]);

      for await (const chunk of resultStream) {
        // @ts-ignore
        const text = chunk.text; 
        if (text) {
          fullText += text;
          setMessages(prev => prev.map(m => 
            m.id === modelMsgId ? { ...m, text: fullText, isThinking: false } : m
          ));
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "model", text: "Sorry, I encountered an error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Persona Selector Header */}
      <div className="glass-panel" style={{ 
        padding: "16px 24px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        borderBottom: "1px solid var(--border-color)",
        zIndex: 5
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
           <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Persona:</span>
           <div style={{ display: "flex", gap: "8px" }}>
             <button 
               onClick={() => setPersona("general")}
               style={{ 
                 background: persona === "general" ? "var(--card-bg)" : "transparent",
                 border: `1px solid ${persona === "general" ? "var(--accent-color)" : "var(--border-color)"}`,
                 color: persona === "general" ? "white" : "var(--text-secondary)",
                 padding: "6px 12px",
                 borderRadius: "20px",
                 fontSize: "12px",
                 cursor: "pointer"
               }}>
               General
             </button>
             <button 
               onClick={() => setPersona("dl_tutor")}
               style={{ 
                 background: persona === "dl_tutor" ? "var(--card-bg)" : "transparent",
                 border: `1px solid ${persona === "dl_tutor" ? "var(--accent-color)" : "var(--border-color)"}`,
                 color: persona === "dl_tutor" ? "#6366f1" : "var(--text-secondary)",
                 padding: "6px 12px",
                 borderRadius: "20px",
                 fontSize: "12px",
                 cursor: "pointer",
                 display: "flex",
                 alignItems: "center",
                 gap: "6px"
               }}>
               <Icons.Book />
               Deep Learning w/ Python 3rd Ed.
             </button>
           </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ 
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "80%",
          }}>
            <div style={{ 
              padding: "12px 16px", 
              borderRadius: "12px", 
              backgroundColor: msg.role === "user" ? "var(--accent-color)" : "var(--card-bg)",
              color: "white",
              lineHeight: "1.5",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              {msg.image && (
                <img src={`data:image/jpeg;base64,${msg.image}`} alt="User upload" style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "8px" }} />
              )}
              {msg.text}
              {msg.isThinking && <span className="animate-pulse">...</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "20px" }}>
        {attachment && (
          <div style={{ marginBottom: "10px", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--card-bg)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>
            <span>Image attached</span>
            <button onClick={() => setAttachment(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><Icons.X /></button>
          </div>
        )}
        <div className="glass-panel" style={{ 
          display: "flex", 
          gap: "10px", 
          padding: "10px", 
          borderRadius: "12px"
        }}>
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "8px" }}
          >
            <Icons.Plus />
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileSelect}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={persona === "dl_tutor" ? "Ask about Keras 3, layers, or training loops..." : "Type a message..."}
            style={{ 
              flex: 1, 
              background: "transparent", 
              border: "none", 
              color: "white", 
              outline: "none",
              fontSize: "14px"
            }}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || (!input && !attachment)}
            style={{ 
              background: "var(--accent-color)", 
              border: "none", 
              color: "white", 
              padding: "8px", 
              borderRadius: "8px", 
              cursor: "pointer",
              opacity: (isLoading || (!input && !attachment)) ? 0.5 : 1
            }}
          >
            {isLoading ? <Icons.Loader /> : <Icons.Send />}
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Imagine View
const ImagineView = () => {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setImage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] }
      });
      
      // Iterate to find image part
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "512px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ 
          width: "100%", 
          aspectRatio: "1", 
          backgroundColor: "var(--card-bg)", 
          borderRadius: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          overflow: "hidden",
          border: "1px solid var(--border-color)"
        }}>
          {loading ? (
             <div style={{ color: "var(--accent-color)" }}><Icons.Loader /></div>
          ) : image ? (
            <img src={image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>Generated image will appear here</span>
          )}
        </div>
        
        <div className="glass-panel" style={{ display: "flex", gap: "10px", padding: "8px", borderRadius: "12px" }}>
          <input 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe an image..."
            style={{ flex: 1, background: "transparent", border: "none", color: "white", padding: "8px", outline: "none" }}
            onKeyDown={e => e.key === "Enter" && generateImage()}
          />
          <button 
            onClick={generateImage}
            disabled={loading || !prompt}
            style={{ background: "var(--accent-color)", border: "none", borderRadius: "8px", color: "white", padding: "8px 16px", cursor: "pointer", fontWeight: "500" }}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. Live View
const LiveView = () => {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);

  const startSession = async () => {
    try {
      addLog("Initializing...");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const outputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      let nextStartTime = 0;

      // Audio Input
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          int16[i] = inputData[i] * 32768;
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
        
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({ 
            media: { mimeType: 'audio/pcm;rate=16000', data: base64 } 
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Connect to Live API
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: { 
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a friendly, helpful assistant. You can see me and hear me."
        },
        callbacks: {
          onopen: () => {
            setConnected(true);
            addLog("Connected!");
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              const audioBytes = base64ToUint8Array(audioData);
              // Decode PCM 24k
              const int16 = new Int16Array(audioBytes.buffer);
              const float32 = new Float32Array(int16.length);
              for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;
              
              const buffer = outputContext.createBuffer(1, float32.length, 24000);
              buffer.getChannelData(0).set(float32);
              
              const src = outputContext.createBufferSource();
              src.buffer = buffer;
              src.connect(outputContext.destination);
              
              const now = outputContext.currentTime;
              const start = Math.max(now, nextStartTime);
              src.start(start);
              nextStartTime = start + buffer.duration;
            }
          },
          onclose: () => {
             setConnected(false);
             addLog("Disconnected");
          },
          onerror: (e) => console.error(e)
        }
      });

      sessionRef.current = session;

      // Video loop
      const sendFrame = async () => {
        if (!sessionRef.current || !videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = videoRef.current.videoWidth / 4; // Downscale for perf
          canvasRef.current.height = videoRef.current.videoHeight / 4;
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
          const base64 = await new Promise<string>(r => {
             canvasRef.current?.toBlob(b => {
                if(b) blobToBase64(b).then(r);
             }, 'image/jpeg', 0.6);
          });
          sessionRef.current.sendRealtimeInput({
             media: { mimeType: 'image/jpeg', data: base64 }
          });
        }
        setTimeout(sendFrame, 1000); // 1 FPS for demo
      };
      sendFrame();

    } catch (e) {
      console.error(e);
      addLog("Error starting session");
    }
  };

  const stopSession = () => {
     // Reload to kill contexts/streams cleanly
     window.location.reload();
  };

  return (
    <div style={{ flex: 1, position: "relative", background: "black" }}>
      <video 
        ref={videoRef} 
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: connected ? 1 : 0.3 }} 
        muted 
        playsInline 
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        {!connected && (
          <button 
            onClick={startSession}
            style={{ 
              background: "var(--accent-color)", 
              color: "white", 
              border: "none", 
              padding: "16px 32px", 
              borderRadius: "32px", 
              fontSize: "18px",
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)"
            }}
          >
            Start Live Session
          </button>
        )}
      </div>

      {connected && (
        <div style={{ position: "absolute", bottom: "30px", left: "0", width: "100%", display: "flex", justifyContent: "center" }}>
          <button 
            onClick={stopSession}
             style={{ background: "#ef4444", color: "white", border: "none", padding: "12px 24px", borderRadius: "24px", cursor: "pointer" }}
          >
            End Call
          </button>
        </div>
      )}

      <div style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(0,0,0,0.5)", padding: "10px", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace", color: "#0f0" }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};

// 5. Motion View
const MotionView = () => {
  const [prompt, setPrompt] = useState("");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const generateVideo = async () => {
    if (!window.aistudio) {
        setStatus("AI Studio Global not found.");
        return;
    }

    try {
      setStatus("Checking API Key...");
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        // Assume success, re-instantiate GenAI handled by browser env mostly but here we use normal instantiation
        // Since Veo requires paid key, the openSelectKey sets it for the environment context usually.
        // We will create a new instance just in case.
      }
      
      // Note: We use process.env.API_KEY here assuming it gets populated or the browser injects it.
      // If using the browser specific playground flow:
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      setStatus("Generating... (this takes ~1-2 mins)");
      let op = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });

      while (!op.done) {
        await new Promise(r => setTimeout(r, 5000));
        setStatus("Polling status...");
        op = await ai.operations.getVideosOperation({ operation: op });
      }

      const uri = op.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const fetchUri = `${uri}&key=${process.env.API_KEY}`;
        const res = await fetch(fetchUri);
        const blob = await res.blob();
        setVideoUri(URL.createObjectURL(blob));
        setStatus("Done!");
      }
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message || "Unknown error"}`);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "600px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ 
          width: "100%", 
          aspectRatio: "16/9", 
          backgroundColor: "var(--card-bg)", 
          borderRadius: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          position: "relative"
        }}>
           {videoUri ? (
             <video src={videoUri} controls style={{ width: "100%", height: "100%" }} />
           ) : (
             <div style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
               <Icons.Video />
               <span>{status || "Enter a prompt to generate video"}</span>
             </div>
           )}
        </div>

        <div className="glass-panel" style={{ display: "flex", gap: "10px", padding: "8px", borderRadius: "12px" }}>
          <input 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="A cyberpunk cat driving a neon car..."
            style={{ flex: 1, background: "transparent", border: "none", color: "white", padding: "8px", outline: "none" }}
          />
          <button 
            onClick={generateVideo}
            disabled={!!(status && status !== "Done!" && !status.startsWith("Error")) || !prompt}
            style={{ background: "var(--accent-color)", border: "none", borderRadius: "8px", color: "white", padding: "8px 16px", cursor: "pointer" }}
          >
            Create
          </button>
        </div>
        
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
          Requires paid API key via Google AI Studio. <br/>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" style={{ color: "var(--text-secondary)" }}>Billing Info</a>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
const App = () => {
  const [mode, setMode] = useState<Mode>("chat");

  return (
    <>
      <Sidebar activeMode={mode} setMode={setMode} />
      <main style={{ flex: 1, backgroundColor: "var(--bg-color)", position: "relative", overflow: "hidden" }}>
        {mode === "chat" && <ChatView />}
        {mode === "imagine" && <ImagineView />}
        {mode === "live" && <LiveView />}
        {mode === "motion" && <MotionView />}
      </main>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);