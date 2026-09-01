import {useState,useEffect} from 'react';
import {blink} from '../lib/blink';
import {adminPacksApi} from './adminApi';
const ADMIN_SESSION_KEY='pp_admin_session';
export function useAdminAuth(){const[isAdmin,setIsAdmin]=useState(false),[isLoading,setIsLoading]=useState(true),[error,setError]=useState<string|null>(null);useEffect(()=>{setIsAdmin(sessionStorage.getItem(ADMIN_SESSION_KEY)==='true');setIsLoading(false)},[]);
 const login=async(identifier:string,password:string)=>{setError(null);const trimmed=identifier.trim();try{const result=await adminPacksApi.login(trimmed,password);if(result.success){localStorage.setItem('pocketpull_admin_pass',result.adminPassword);sessionStorage.setItem(ADMIN_SESSION_KEY,'true');setIsAdmin(true);return true;}}catch{}
 try{let email=trimmed;if(!email.includes('@')){setError('Please use your admin email for account login.');return false;}await blink.auth.signInWithEmail(email,password);await adminPacksApi.list();sessionStorage.setItem(ADMIN_SESSION_KEY,'true');setIsAdmin(true);return true;}catch(e:any){try{await blink.auth.signOut()}catch{}setError(e?.message||'Invalid username or password.');return false;}};
 const logout=async()=>{setIsAdmin(false);sessionStorage.removeItem(ADMIN_SESSION_KEY);localStorage.removeItem('pocketpull_admin_pass');try{await blink.auth.signOut()}catch{}};return{isAdmin,isLoading,error,login,logout};}
