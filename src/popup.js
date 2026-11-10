document.getElementById('sidepanel').addEventListener('click',async()=>{const[tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab?.windowId)await chrome.sidePanel.open({windowId:tab.windowId});window.close();});
document.getElementById('floating').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'open-floating'});window.close();});
