import os from 'os';

/**
 * Discovers the local IPv4 address on the active LAN/Wi-Fi interface.
 * Filters out internal loopbacks, VirtualBox, VMware, WSL, and Docker virtual adapters.
 * @returns {{ primaryIp: string, allIps: Array<{ name: string, ip: string, isVirtual: boolean }> }}
 */
export function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const allIps = [];
  let primaryIp = '127.0.0.1';

  // Words that indicate virtual/tunnel network adapters to ignore if physical is present
  const virtualKeywords = ['virtual', 'vbox', 'vmware', 'docker', 'wsl', 'vethernet', 'hyper-v', 'loopback', 'npcap', 'tap', 'tun'];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    const nameLower = name.toLowerCase();
    const isVirtual = virtualKeywords.some(keyword => nameLower.includes(keyword));

    for (const addr of addrs) {
      // Must be IPv4 and non-internal loopback
      if (addr.family === 'IPv4' && !addr.internal) {
        allIps.push({
          name: name,
          ip: addr.address,
          isVirtual
        });
      }
    }
  }

  // Pick best primary IP: first physical adapter (e.g. Wi-Fi or Ethernet), or fallback to first non-loopback IP
  const physicalAdapter = allIps.find(item => !item.isVirtual);
  if (physicalAdapter) {
    primaryIp = physicalAdapter.ip;
  } else if (allIps.length > 0) {
    primaryIp = allIps[0].ip;
  }

  return {
    primaryIp,
    allIps
  };
}
