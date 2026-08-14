import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyAaY8jpBn62hbs1OgZeDocV4IKhjG4Opk0",
  authDomain: "asistente-uniformes.firebaseapp.com",
  projectId: "asistente-uniformes",
  storageBucket: "asistente-uniformes.firebasestorage.app",
  messagingSenderId: "414923517330",
  appId: "1:414923517330:web:ae9e6e6b9e4a01258b254b"
};

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)