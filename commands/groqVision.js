const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "card-enriched.json");

let enrichCache = {};
try {
  enrichCache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
} catch {
  enrichCache = {};
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(enrichCache, null, 2));
  } catch {}
}

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 20000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Image fetch timeout"));
    });
  });
}

function isGifBuffer(buf) {
  return buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
}

function getMime(buf) {
  if (isGifBuffer(buf)) return "image/gif";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  return "image/jpeg";
}

async function callGroqVision(imageUrl) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured in environment");

  const imgBuf = await fetchImageBuffer(imageUrl);
  const base64 = imgBuf.toString("base64");
  const mime = getMime(imgBuf);

  const body = JSON.stringify({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${base64}` },
          },
          {
            type: "text",
            text: 'This is an anime/manga trading card. Identify: 1) The character name shown, 2) The anime or manga series this character is from. Reply ONLY in JSON: {"name": "...", "series": "..."}',
          },
        ],
      },
    ],
    max_tokens: 100,
    temperature: 0.1,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.groq.com",
        path: "/openai/v1/chat/completions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 25000,
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              resolve({ name: parsed.name || null, series: parsed.series || "Unknown" });
            } else {
              resolve({ name: null, series: "Unknown" });
            }
          } catch {
            reject(new Error("Failed to parse Groq response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Groq API timeout"));
    });
    req.write(body);
    req.end();
  });
}

async function getOrEnrichSeries(cardId, imageUrl) {
  if (enrichCache[cardId]) return enrichCache[cardId].series || "—";
  try {
    const result = await callGroqVision(imageUrl);
    enrichCache[cardId] = { series: result.series, name: result.name, analyzedAt: Date.now() };
    saveCache();
    return result.series || "—";
  } catch {
    return "—";
  }
}

function getCachedSeries(cardId) {
  return enrichCache[cardId]?.series || null;
}

async function fetchCardMedia(imageUrl) {
  try {
    const buf = await fetchImageBuffer(imageUrl);
    return { buffer: buf, isGif: isGifBuffer(buf) };
  } catch {
    return null;
  }
}

module.exports = { getOrEnrichSeries, getCachedSeries, fetchCardMedia, callGroqVision };
