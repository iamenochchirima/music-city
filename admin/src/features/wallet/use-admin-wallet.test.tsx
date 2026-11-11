import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, renderHook, waitFor} from "@testing-library/react";
import {useAdminWallet} from "./use-admin-wallet";
const m=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),fetch:vi.fn(),sign:vi.fn(),authorize:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),address:"wallet-a",connected:true}));
vi.mock("@/lib/api/http-client",()=>({httpClient:m}));
vi.mock("./admin-wallet-context",()=>({useAdminWalletConnection:()=>({ready:true,wallet:m.connected?{address:m.address,signTransaction:m.sign}:null,authorize:m.authorize,connect:m.connect,disconnect:m.disconnect})}));
const network="Test SDF Network ; September 2015";
beforeEach(()=>{
 vi.resetAllMocks();m.address="wallet-a";m.connected=true;
 m.get.mockResolvedValue({walletAddress:"wallet-a",eligible:true,networkPassphrase:network});
 m.post.mockImplementation(async(path:string)=>path==="/wallet/requests"?{id:"request",token:"capability",expiresAt:new Date(Date.now()+60000).toISOString()}:{});
 m.fetch.mockImplementation(async(url:string)=>({ok:true,json:async()=>url.endsWith("/challenge")?{transaction:"canonical-xdr",networkPassphrase:network}:{walletAddress:"wallet-a",networkPassphrase:network}}));
 m.authorize.mockResolvedValue(undefined);m.sign.mockResolvedValue("signed-xdr");vi.stubGlobal("fetch",m.fetch);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("connects directly on admin without opening the main app",async()=>{
 m.connected=false;const open=vi.spyOn(window,"open");const {result}=renderHook(()=>useAdminWallet("admin-a"));
 await act(()=>result.current.link());expect(m.connect).toHaveBeenCalled();expect(open).not.toHaveBeenCalled();expect(m.post).not.toHaveBeenCalled();open.mockRestore();
});
it("signs the canonical request with the connected wallet and confirms as this admin",async()=>{
 const {result}=renderHook(()=>useAdminWallet("admin-a"));await waitFor(()=>expect(result.current.status).not.toBeNull());
 await act(()=>result.current.signAttempt("topup"));
 expect(m.sign).toHaveBeenCalledWith("canonical-xdr");
 expect(m.post.mock.calls).toEqual([["/wallet/requests",{kind:"sign",attemptId:"topup"},"admin-a"],["/wallet/requests/request/confirm",{},"admin-a"]]);
 expect(m.fetch.mock.calls[2][1].headers["X-Wallet-Request-Token"]).toBe("capability");
 expect(JSON.parse(m.fetch.mock.calls[2][1].body)).toEqual({signedTransaction:"signed-xdr"});
});
it("blocks another wallet before preparing or signing",async()=>{
 m.address="wallet-b";const {result}=renderHook(()=>useAdminWallet("admin-a"));await waitFor(()=>expect(result.current.status).not.toBeNull());
 await act(async()=>{await expect(result.current.signAttempt("topup")).rejects.toThrow("linked");});expect(m.sign).not.toHaveBeenCalled();expect(m.post).not.toHaveBeenCalled();
});
it("cancels without sending a signature when wallet authentication fails",async()=>{
 m.authorize.mockRejectedValue(Error("Authentication cancelled"));const {result}=renderHook(()=>useAdminWallet("admin-a"));
 await act(async()=>{await expect(result.current.link()).rejects.toThrow("cancelled");});expect(m.sign).not.toHaveBeenCalled();expect(m.post).toHaveBeenCalledWith("/wallet/requests/request/cancel",{},"admin-a");
});
it("never forwards a signature if the admin account changes during signing",async()=>{
 let finish!:(value:string)=>void;m.sign.mockImplementation(()=>new Promise<string>(resolve=>{finish=resolve;}));
 const {result,rerender}=renderHook(({token})=>useAdminWallet(token),{initialProps:{token:"admin-a"}});
 let done!:Promise<void>;act(()=>{done=result.current.link();});
 await waitFor(()=>expect(m.sign).toHaveBeenCalled());rerender({token:"admin-b"});
 await act(async()=>{finish("signed-xdr");await expect(done).rejects.toThrow("account changed");});
 expect(m.fetch.mock.calls.some(([url])=>url.endsWith("/signed"))).toBe(false);
 expect(m.post.mock.calls.some(([url])=>url.endsWith("/confirm"))).toBe(false);
});
it("rejects a network mismatch before asking the wallet to sign",async()=>{
 m.fetch.mockResolvedValue({ok:true,json:async()=>({networkPassphrase:"other network"})});const {result}=renderHook(()=>useAdminWallet("admin-a"));
 await act(async()=>{await expect(result.current.link()).rejects.toThrow("same Stellar network");});expect(m.sign).not.toHaveBeenCalled();
});
