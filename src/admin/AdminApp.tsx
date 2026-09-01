import React,{useEffect,useState} from 'react';
import {useAdminAuth} from './useAdminAuth';
import {AdminLogin} from './AdminLogin';
import {AdminDashboard} from './AdminDashboard';
import {adminPacksApi} from './adminApi';
const Spinner=()=> <div className="min-h-screen bg-[#07080e] flex items-center justify-center"><div className="flex flex-col items-center gap-4"><div className="w-10 h-10 rounded-full border-2 border-[#9b5cff]/20 border-t-[#9b5cff] animate-spin"/><p className="text-white/20 text-[12px] uppercase tracking-widest font-display">Verifying access...</p></div></div>;
export const AdminApp:React.FC=()=>{const {isAdmin,isLoading,error,login,logout}=useAdminAuth();const [roleVerified,setRoleVerified]=useState<boolean|null>(null);useEffect(()=>{if(isLoading)return;if(isAdmin){setRoleVerified(true);return;}adminPacksApi.list().then(()=>{sessionStorage.setItem('pp_admin_session','true');setRoleVerified(true)}).catch(()=>setRoleVerified(false))},[isAdmin,isLoading]);if(isLoading||roleVerified===null)return <Spinner/>;if(!isAdmin&&!roleVerified)return <AdminLogin onLogin={login} error={error}/>;return <AdminDashboard onLogout={logout}/>;};
