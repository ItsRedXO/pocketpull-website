import {useState,useEffect} from 'react';
import {blink} from '../lib/blink';
import {adminPacksApi} from './adminApi';
const ADMIN_SESSION_KEY='pp_admin_session';
export function useAdminAuth(){const[isAdmin,setIsAdmin]=useState(false),[isLoading,setIsLoading]=useState(true),[error,setError]=useState<string|null>(null);useEffect(()=>{setIsAdmin(sessionStorage.getItem(ADMIN_SESSION_KEY)==='true');setIsLoading(false)},[]);
 const login=async(identifier:string,password:string)=>{setError(null);try{const result=await adminPacksApi.login(identifier.trim(),password);if(result.success){localStorage.setItem('pocketpull_admin_pass',result.adminPassword);sessionStorage.setItem(ADMIN_SESSION_KEY,'true');setIsAdmin(true);return true;}setError('Invalid username or password.');return false}catch(e:any){const msg=String(e?.message||'').toLowerCase();setError(msg.includes('rate')?'Too many attempts. Please wait a moment.':e?.message||'Invalid username or password.');return false;}};
 const logout=async()=>{setIsAdmin(false);sessionStorage.removeItem(ADMIN_SESSION_KEY);localStorage.removeItem('pocketpull_admin_pass');try{await blink.auth.signOut()}catch{}};return{isAdmin,isLoading,error,login,logout};}
