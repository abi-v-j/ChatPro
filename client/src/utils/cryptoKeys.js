import axios from "axios";

// Base64 helpers
const uint8ArrayToB64 = (arr) =>
  btoa(String.fromCharCode(...arr));

export async function generateAndUploadKeyPair(token, userId) {
  const existingOwner = localStorage.getItem("key_owner");

  if (
    localStorage.getItem("privateKey") &&
    existingOwner === userId
  ) {
    console.log("Encryption keys already exist for this user.");
    return;
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const pubEx = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privEx = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const pubB64 = uint8ArrayToB64(new Uint8Array(pubEx));
  const privB64 = uint8ArrayToB64(new Uint8Array(privEx));

  localStorage.setItem("publicKey", pubB64);
  localStorage.setItem("privateKey", privB64);

  await axios.post(
    "http://127.0.0.1:8000/set-public-key",
    { public_key: pubB64 },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  localStorage.setItem("key_owner", userId);

  console.log("Encryption keys generated and uploaded.");
}
