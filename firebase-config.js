// 1. As tuas credenciais secretas do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCeTyqN_PQWHwIOXPkyN_RXPlUEpznm4P4",
  authDomain: "cosmic-book.firebaseapp.com",
  projectId: "cosmic-book",
  storageBucket: "cosmic-book.firebasestorage.app",
  messagingSenderId: "964180423182",
  appId: "1:964180423182:web:d52e3c1a91ae08a160425f"
};

// 2. Inicializa o Firebase com as tuas configurações
firebase.initializeApp(firebaseConfig);

// 3. Cria a variável "db" que vai controlar o nosso banco de dados NoSQL (Firestore)
const db = firebase.firestore();