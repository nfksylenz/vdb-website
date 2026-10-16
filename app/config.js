window.VDB_CONFIG = {
  trainerEmail: "vdbcoach@gmail.com",          // la tua email, in minuscolo: è quella con cui entri nel pannello trainer
  whatsapp: "393884758884",                  // numero con prefisso, senza +
  instagram: "vdb_trainer",                  // nome utente senza @
  privacy: {                                 // dati del titolare, mostrati nell'informativa privacy
    version: "1",                            // cambia il numero se modifichi l'informativa: i clienti dovranno riaccettare
    owner: "Vincenzo Di Buono",
    address: "Acerra (NA)",
    email: "vdbcoach@gmail.com",
    retention: "12 mesi dalla fine del rapporto, salvo obblighi di legge"
  },
  firebase: {                                // copia questi valori da Firebase (Impostazioni progetto > App web)
    apiKey: "// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCPFPPqv8Y4uoPDQXYUIBloqTPvAxN--r4",
  authDomain: "vdb-trainer-app.firebaseapp.com",
  projectId: "vdb-trainer-app",
  storageBucket: "vdb-trainer-app.firebasestorage.app",
  messagingSenderId: "277230424636",
  appId: "1:277230424636:web:ecf12ac9d5a25c8f8fe939",
  measurementId: "G-VC0LWZSZ3E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);",
