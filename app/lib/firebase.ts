// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAsxG2pFmtPAx4ouyZFXooHNpS9347zITs",
  authDomain: "cactus-b1455.firebaseapp.com",
  databaseURL: "https://cactus-b1455-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cactus-b1455",
  storageBucket: "cactus-b1455.firebasestorage.app",
  messagingSenderId: "491950129510",
  appId: "1:491950129510:web:b115810b04faafb34cc8a7",
  measurementId: "G-B43NW49ZR1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);