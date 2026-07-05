import fs from "fs";
import path from "path";
import https from "https";

// Create destination directory under models
const destDir = path.resolve("models");
fs.mkdirSync(destDir, { recursive: true });
const destPath = path.join(destDir, "gemma-4-E2B-it-web.task");

const url = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task";

console.log("📥 Downloading Gemma 4 E2B Web-Inference Model (2.0 GB)...");
console.log("   Destination: " + destPath);

const file = fs.createWriteStream(destPath);

const getRedirectOrDownload = (sourceUrl) => {
  https.get(sourceUrl, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      getRedirectOrDownload(res.headers.location);
    } else if (res.statusCode === 200) {
      startDownload(res);
    } else {
      console.error(`❌ Server returned error code: ${res.statusCode}`);
    }
  }).on("error", (err) => {
    console.error("❌ Connection failed:", err.message);
  });
};

function startDownload(response) {
  const total = parseInt(response.headers["content-length"], 10);
  let downloaded = 0;
  let lastPercent = -1;

  response.on("data", (chunk) => {
    downloaded += chunk.length;
    file.write(chunk);
    const percent = Math.floor((downloaded / total) * 100);
    if (percent !== lastPercent) {
      process.stdout.write(`\r   Progress: [${"=".repeat(percent / 5)}${" ".repeat(20 - percent / 5)}] ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
      lastPercent = percent;
    }
  });

  response.on("end", () => {
    file.end();
    console.log("\n✅ Gemma 4 model downloaded successfully and saved!");
  });
}

getRedirectOrDownload(url);
