const fs = require("fs");
const crypto = require("crypto");

const algorithm = "aes-256-cbc";
const secretKey = crypto.createHash("sha256").update("xyzABC123").digest(); 
const ivLength = 16; // AES block size

function encrypt(text) {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted; // prepend IV
}

function decrypt(encryptedText) {
  const [ivStr, content] = encryptedText.split(":");
  const iv = Buffer.from(ivStr, "base64");
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  let decrypted = decipher.update(content, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Encrypt dataset file
function encryptDataset(filePath) {
  const dataset = JSON.parse(fs.readFileSync(filePath, "utf8"));

  dataset.forEach(block => {
    block.conversation.forEach(msg => {
      msg.text = encrypt(msg.text);
    });
  });

  fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
  console.log("✅ Dataset encrypted successfully.");
}

module.exports = { encrypt, decrypt, encryptDataset };