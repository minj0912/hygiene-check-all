import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// =============================================
// Firebase 설정을 아래에 입력하세요.
// Firebase Console → 프로젝트 설정 → 앱 → firebaseConfig 복사
// =============================================
const firebaseConfig = {
  apiKey: "AIzaSyCndLX_Y4Cf3g_xHFfZx22aYilwxPvOv90",
  authDomain: "restroom-8e1da.firebaseapp.com",
  projectId: "restroom-8e1da",
  storageBucket: "restroom-8e1da.firebasestorage.app",
  messagingSenderId: "318591638843",
  appId: "1:318591638843:web:4c9794fb8d2a6398876b1e",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
