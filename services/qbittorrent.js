import axios from "axios";

export async function addTorrent(torrentUrl) {
  // login
  const loginResp = await axios.post(
    `${process.env.QBITTORRENT_URL}/api/v2/auth/login`,
    new URLSearchParams({
      username: process.env.QBIT_USER,
      password: process.env.QBIT_PASS,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${process.env.QBITTORRENT_URL}`,
      },
      maxRedirects: 0,
    }
  );

  const cookie = loginResp.headers["set-cookie"]
    .find((c) => c.startsWith("SID="))
    .split(";")[0];

  // add torrent
  const addResp = await axios.post(
    `${process.env.QBITTORRENT_URL}/api/v2/torrents/add`,
    new URLSearchParams({ urls: torrentUrl }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
        Referer: `${process.env.QBITTORRENT_URL}`,
      },
    }
  );

  if (addResp.status !== 200) {
    throw new Error(`Failed to add torrent: ${addResp.statusText}`);
  }
}
