chrome.runtime.onInstalled.addListener(async () => {
  const stored=await chrome.storage.local.get('settings');
  if(!stored.settings)await chrome.storage.local.set({settings:{symbol:'R_100',historySize:100,theme:'dark'}});
  if(chrome.sidePanel?.setPanelBehavior)await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
});
async function floatingWindow(){const base=chrome.runtime.getURL('src/panel.html?mode=window'),wins=await chrome.windows.getAll({populate:true});const existing=wins.find(w=>w.tabs?.some(t=>t.url?.startsWith(base)));if(existing){await chrome.windows.update(existing.id,{focused:true,state:'normal'});return existing.id;}const created=await chrome.windows.create({url:base,type:'popup',width:500,height:900,focused:true});return created.id;}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg.type==='open-panel'){const windowId=sender.tab?.windowId??msg.windowId;if(windowId)chrome.sidePanel.open({windowId}).then(()=>reply({ok:true})).catch(e=>reply({error:e.message}));else reply({error:'Could not find the active browser window.'});}
  else if(msg.type==='open-floating')floatingWindow().then(windowId=>reply({ok:true,windowId})).catch(e=>reply({error:e.message}));
  else if(msg.type==='window-state'||msg.type==='close-floating'){chrome.windows.getAll({populate:true}).then(wins=>{const base=chrome.runtime.getURL('src/panel.html?mode=window'),w=wins.find(x=>x.tabs?.some(t=>t.url?.startsWith(base)));if(!w)return reply({ok:false});const task=msg.type==='close-floating'?chrome.windows.remove(w.id):chrome.windows.update(w.id,{state:msg.state});task.then(()=>reply({ok:true})).catch(e=>reply({error:e.message}));});}
  return true;
});
