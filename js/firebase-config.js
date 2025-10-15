import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";

const firebaseConfig = {
    // Reemplaza esto con tu configuración de Firebase
    apiKey: "AIzaSyDNHK6WkEGaMq9qppTURcBIJAmsF0bTzp8",
    authDomain: "firechan-ec.firebaseapp.com",
    projectId: "firechan-ec",
    storageBucket: "firechan-ec.appspot.com",
    messagingSenderId: "459286874755",
    appId: "1:459286874755:web:fd8cb583e8a383a59c69b6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };
