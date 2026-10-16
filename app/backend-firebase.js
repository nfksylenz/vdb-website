/* Collegamento a Firebase (accesso con email/password e archivio Firestore). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const CFG = window.VDB_CONFIG;
const app = initializeApp(CFG.firebase);
const auth = getAuth(app);
const fs = getFirestore(app);
const d = (...p) => doc(fs, ...p);
const c = (...p) => collection(fs, ...p);

window.VDB_BACKEND = {
  onAuth(cb){ onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)); },
  async login(email, pass){ await signInWithEmailAndPassword(auth, email, pass); },
  logout(){ return signOut(auth); },
  resetPassword(email){ return sendPasswordResetEmail(auth, email); },

  async getClient(uid){ const s = await getDoc(d("clients", uid)); return s.exists() ? { id: uid, ...s.data() } : null; },
  async listClients(){ const s = await getDocs(c("clients")); return s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name))); },
  async createClient({ name, email, password, goal }){
    // Secondo accesso temporaneo: crea l'account senza far uscire il trainer.
    const sec = initializeApp(CFG.firebase, "secondary-" + Date.now());
    const secAuth = getAuth(sec);
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secAuth);
    await setDoc(d("clients", uid), { name, email, goal: goal || "", createdAt: Date.now() });
    return uid;
  },
  saveConsent(uid, consent){ return updateDoc(d("clients", uid), { consent }); },
  updateClient(uid, fields){ return updateDoc(d("clients", uid), fields); },

  async getPlan(uid){ const s = await getDoc(d("clients", uid, "plans", "current")); return s.exists() ? s.data() : null; },
  savePlan(uid, data){ return setDoc(d("clients", uid, "plans", "current"), data, { merge: true }); },
  async getPrivate(uid){ const s = await getDoc(d("clients", uid, "private", "notes")); return s.exists() ? (s.data().text || "") : ""; },
  savePrivate(uid, text){ return setDoc(d("clients", uid, "private", "notes"), { text }); },

  async listSessions(uid){ const s = await getDocs(query(c("clients", uid, "sessions"), orderBy("ts"))); return s.docs.map(x => x.data()); },
  addSession(uid, sess){ return setDoc(d("clients", uid, "sessions", String(sess.ts)), sess); },
  async listWeights(uid){ const s = await getDocs(c("clients", uid, "weights")); return s.docs.map(x => x.data()).sort((a, b) => a.d < b.d ? -1 : 1); },
  setWeight(uid, w){ return setDoc(d("clients", uid, "weights", w.d), w); },
  deleteWeight(uid, day){ return deleteDoc(d("clients", uid, "weights", day)); }
};
window.dispatchEvent(new Event("vdb-backend"));
