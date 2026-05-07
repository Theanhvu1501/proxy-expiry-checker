const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs"); // Thêm thư viện đọc file của Node.js

// Hàm gửi tin nhắn Telegram
async function sendTelegram(botToken, chatId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(url, { chat_id: chatId, text: message, parse_mode: "HTML" });
  } catch (error) {
    console.error("❌ Lỗi gửi Telegram:", error.response?.data || error.message);
  }
}

// ==========================================
// HÀM KIỂM TRA M2PROXY
// ==========================================
async function checkM2Proxy(config) {
  if (!config.m2proxy_token) return;

  try {
    const API_URL = `https://api.m2proxy.com/user/data/getlistproxy?token=${config.m2proxy_token}`;
    const response = await axios.get(API_URL);

    if (response.data.Status.toLowerCase() !== "success") return;

    const proxyList = response.data.Data;
    const now = new Date();
    let warnings = [];
    let telegramMessage = `⚠️ <b>[M2PROXY] SẮP HẾT HẠN </b>\n\n`;

    proxyList.forEach((proxy) => {
      const expiryDate = new Date(proxy.expired_date);
      const diffTime = expiryDate - now;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays > 0 && diffDays <= 2) {
        const hoursLeft = (diffDays * 24).toFixed(1);
        warnings.push({ id: proxy.id, note: proxy.note || "Trống", timeLeft: `${hoursLeft} h` });

        telegramMessage += `📌 <b>Note:</b> ${proxy.note || "Trống"}\n`;
        telegramMessage += `🔹 ID: <code>${proxy.id}</code>\n`;
        telegramMessage += `🔹 Socks: <code>${proxy.public_ip}:${proxy.socks_port}</code>\n`;
        telegramMessage += `🔹 Còn lại: <b>${hoursLeft} giờ</b>\n`;
        telegramMessage += `---------------------------\n`;
      }
    });

    if (warnings.length > 0) {
      console.log(`⚠️ [${config.projectName} - M2Proxy] Có proxy sắp hết hạn!`);
      console.table(warnings);
      await sendTelegram(config.telegram_token, config.telegram_chat_id, telegramMessage);
    }
  } catch (error) {
    console.error(`❌ Lỗi M2Proxy (${config.projectName}):`, error.message);
  }
}

// ==========================================
// HÀM KIỂM TRA ZINGPROXY
// ==========================================
async function checkZingProxy(config) {
  if (!config.zingproxy_token) return;

  try {
    const API_URL = 'https://api.zingproxy.com/proxy/datacenter-private-ipv4/running';
    const response = await axios.get(API_URL, {
      headers: { 'Authorization': `Bearer ${config.zingproxy_token}` }
    });

    if (response.data.status !== "success") return;

    const proxyList = response.data.proxies;
    const now = new Date();
    let warnings = [];
    let telegramMessage = `⚠️ <b>[ZINGPROXY] SẮP HẾT HẠN </b>\n\n`;

    proxyList.forEach((proxy) => {
      const expiryDate = new Date(proxy.dateEnd);
      const diffTime = expiryDate - now;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays > 0 && diffDays <= 2) {
        const hoursLeft = (diffDays * 24).toFixed(1);
        warnings.push({ id: proxy.resourceId, note: proxy.note || "Trống", timeLeft: `${hoursLeft} h` });

        telegramMessage += `📌 <b>Note:</b> ${proxy.note || "Trống"}\n`;
        telegramMessage += `🔹 ID: <code>${proxy.resourceId}</code>\n`;
        telegramMessage += `🔹 Proxy: <code>${proxy.ip}:${proxy.portSocks5}</code>\n`; 
        telegramMessage += `🔹 Còn lại: <b>${hoursLeft} giờ</b>\n`;
        telegramMessage += `---------------------------\n`;
      }
    });

    if (warnings.length > 0) {
      console.log(`⚠️ [${config.projectName} - ZingProxy] Có proxy sắp hết hạn!`);
      console.table(warnings);
      await sendTelegram(config.telegram_token, config.telegram_chat_id, telegramMessage);
    }
  } catch (error) {
    console.error(`❌ Lỗi ZingProxy (${config.projectName}):`, error.message);
  }
}

// ==========================================
// HÀM CHẠY TỔNG HỢP CHO TẤT CẢ DỰ ÁN
// ==========================================
async function runAllChecks() {
  console.log(`\n[${new Date().toLocaleString()}] --- BẮT ĐẦU KIỂM TRA ---`);
  
  let configs = [];
  try {
    // ĐỌC FILE JSON TRỰC TIẾP MỖI LẦN CHẠY
    const rawData = fs.readFileSync("./config.json", "utf-8");
    configs = JSON.parse(rawData);
  } catch (error) {
    console.error("❌ Lỗi khi đọc file config.json! Hãy kiểm tra lại cú pháp JSON.");
    return; // Dừng lại nếu file json bị lỗi cú pháp
  }

  // Vòng lặp chạy qua từng cấu hình
  for (const config of configs) {
    console.log(`\n👉 Đang kiểm tra: ${config.projectName}`);
    await checkM2Proxy(config);
    await checkZingProxy(config);
  }

  console.log(`\n[${new Date().toLocaleString()}] --- HOÀN TẤT KIỂM TRA ---`);
}

// Chạy cronjob vào 8:00 sáng mỗi ngày
cron.schedule("0 8 * * *", () => { runAllChecks(); }, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh", 
});

console.log(`🚀 Bot đã bật! Đang lắng nghe file config.json...`);
runAllChecks(); // Test thử ngay lần đầu