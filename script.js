// ================== Konfigurasi ==================
// Alamat endpoint backend FastAPI Anda. Pastikan ini benar.
const CHAT_API_ENDPOINT = 'http://localhost:8000/api/v1/chat/stream';

// ================== Elemen DOM ==================
// Mengambil elemen-elemen HTML yang akan dimanipulasi
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const messageList = document.getElementById('message-list');
const themeSwitcher = document.getElementById('theme-switcher');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');

// ================== State Aplikasi ==================
// Variabel untuk melacak status aplikasi
let isLoading = false;
// Membuat ID unik untuk setiap sesi chat
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// ================== Logika Tema (Theme Logic) ==================

/**
 * Menerapkan tema yang dipilih ke body dan mengganti ikon.
 * @param {string} theme - Nama tema ('light' atau 'dark').
 */
function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme); // Simpan pilihan tema
    if (theme === 'dark') {
        themeIconSun.style.display = 'none';
        themeIconMoon.style.display = 'block';
    } else {
        themeIconSun.style.display = 'block';
        themeIconMoon.style.display = 'none';
    }
}

/**
 * Mengganti tema saat ini.
 */
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Menambahkan event listener ke tombol switcher
themeSwitcher.addEventListener('click', toggleTheme);

// Memeriksa tema yang tersimpan atau preferensi sistem saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(defaultTheme);
});


// ================== Fungsi Utilitas Chat ==================

/**
 * Fungsi untuk scroll otomatis ke pesan paling bawah di kotak chat.
 */
function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
}

/**
 * Fungsi untuk membuat dan menampilkan elemen pesan baru di UI.
 * @param {string} text - Isi teks dari pesan.
 * @param {'user' | 'bot'} sender - Pengirim pesan ('user' atau 'bot').
 * @returns {HTMLElement} - Mengembalikan elemen bubble pesan yang baru dibuat agar bisa dimanipulasi lebih lanjut (misalnya, untuk streaming).
 */
function createMessageElement(text, sender) {
    // Membuat div utama untuk pesan
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    // Jika pengirimnya adalah bot, tambahkan avatar
    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9L12 15L23 9L12 3ZM5 10.17L12 13.5L19 10.17V14.17L12 17.5L5 14.17V10.17Z"/></svg>`;
        messageDiv.appendChild(avatar);
    }
    
    // Membuat div untuk gelembung pesan (bubble)
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    messageDiv.appendChild(bubble);

    // Menambahkan elemen pesan lengkap ke dalam daftar pesan
    messageList.appendChild(messageDiv);
    scrollToBottom(); // Langsung scroll ke bawah
    return bubble; // Kembalikan bubble untuk diisi saat streaming
}

/**
 * Menampilkan atau menyembunyikan indikator loading (titik-titik animasi).
 * @param {boolean} show - Tampilkan jika true, sembunyikan jika false.
 */
function showLoadingIndicator(show) {
    let indicator = document.getElementById('loading-indicator');
    if (show) {
        if (!indicator) { // Hanya buat jika belum ada
            const messageDiv = document.createElement('div');
            messageDiv.id = 'loading-indicator';
            messageDiv.className = 'message bot loading-indicator';
            messageDiv.innerHTML = `
                <div class="avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9L12 15L23 9L12 3ZM5 10.17L12 13.5L19 10.17V14.17L12 17.5L5 14.17V10.17Z"/></svg>
                </div>
                <div class="message-bubble">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
            `;
            messageList.appendChild(messageDiv);
            scrollToBottom();
        }
    } else {
        if (indicator) { // Hapus jika ada
            indicator.remove();
        }
    }
}

// ================== Logika Utama Chat ==================

// Menambahkan 'event listener' yang akan berjalan saat form di-submit (tombol kirim ditekan)
chatForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Mencegah halaman refresh saat form di-submit
    const userInput = chatInput.value.trim(); // Ambil teks dari input dan hapus spasi
    if (!userInput || isLoading) return; // Hentikan jika input kosong atau sedang loading

    // 1. Tampilkan pesan pengguna di UI
    createMessageElement(userInput, 'user');
    chatInput.value = ''; // Kosongkan input field
    
    // 2. Atur status ke mode loading
    isLoading = true;
    sendButton.disabled = true;
    chatInput.disabled = true;
    showLoadingIndicator(true);

    try {
        // 3. Kirim permintaan ke backend menggunakan Fetch API
        const response = await fetch(CHAT_API_ENDPOINT, {
            method: 'POST',
            mode: 'cors', // Penting untuk permintaan cross-origin (frontend & backend beda port)
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: userInput,
                session_id: sessionId,
            }),
        });

        if (!response.ok) { // Jika status response bukan 2xx (sukses)
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!response.body) { // Jika body response tidak bisa dibaca sebagai stream
            throw new Error('ReadableStream not available');
        }
        
        // 4. Proses respons yang datang secara streaming (kata per kata)
        showLoadingIndicator(false); // Sembunyikan indikator loading
        const botBubble = createMessageElement('', 'bot'); // Buat bubble bot kosong untuk diisi
        
        const reader = response.body.getReader(); // Dapatkan pembaca stream
        const decoder = new TextDecoder(); // Siapkan decoder untuk mengubah data stream (bytes) menjadi teks
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read(); // Baca satu bagian data (chunk)
            done = readerDone;
            const chunk = decoder.decode(value, { stream: true });
            
            // Backend mengirim data dalam format JSON per baris, jadi kita pisahkan
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line); // Ubah teks JSON menjadi objek
                    if (parsed.content) {
                        botBubble.textContent += parsed.content; // Tambahkan konten ke bubble bot
                        scrollToBottom(); // Scroll setiap kali ada teks baru
                    }
                } catch (e) {
                    console.warn("Could not parse JSON chunk:", line);
                }
            }
        }

    } catch (error) {
        // Blok ini berjalan jika terjadi error pada koneksi atau server
        console.error('Error fetching chat response:', error);
        showLoadingIndicator(false);
        const errorMessage = `Gagal terhubung ke server. Pastikan backend Anda berjalan di ${CHAT_API_ENDPOINT} dan konfigurasi CORS sudah benar.`;
        createMessageElement(errorMessage, 'bot');
    } finally {
        // Blok ini akan selalu berjalan, baik sukses maupun gagal
        // 5. Kembalikan status ke normal
        isLoading = false;
        sendButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus(); // Fokuskan kursor kembali ke input field
    }
});
