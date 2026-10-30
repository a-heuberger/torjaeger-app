// Nur das, was die App vom Firebase-SDK braucht (wird zu docs/firebase.js gebündelt).
export { initializeApp } from 'firebase/app';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, connectFirestoreEmulator,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, terminate, clearIndexedDbPersistence,
} from 'firebase/firestore';
