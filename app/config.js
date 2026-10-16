/* Configurazione VDB Training: compila i campi qui sotto seguendo GUIDA.md */
window.VDB_CONFIG = {
  trainerEmail: "TUA_EMAIL_TRAINER",          // la tua email, in minuscolo: è quella con cui entri nel pannello trainer
  whatsapp: "393884758884",                  // numero con prefisso, senza +
  instagram: "vdb_trainer",                  // nome utente senza @
  privacy: {                                 // dati del titolare, mostrati nell'informativa privacy
    version: "1",                            // cambia il numero se modifichi l'informativa: i clienti dovranno riaccettare
    owner: "NOME E COGNOME (VDB Personal Trainer)",
    address: "INDIRIZZO, CITTÀ (e P.IVA se presente)",
    email: "EMAIL DI CONTATTO PER LA PRIVACY",
    retention: "12 mesi dalla fine del rapporto, salvo obblighi di legge"
  },
  firebase: {                                // copia questi valori da Firebase (Impostazioni progetto > App web)
    apiKey: "INCOLLA_QUI",
    authDomain: "INCOLLA_QUI",
    projectId: "INCOLLA_QUI",
    storageBucket: "INCOLLA_QUI",
    messagingSenderId: "INCOLLA_QUI",
    appId: "INCOLLA_QUI"
  }
};
