/**
 * Google Drive Integration for WMult Studio
 * Handles Google Drive file picker and audio file import
 */

const API_KEY = 'AIzaSyBTM8idpASUgAmCz8MpZgAEVUwlJDrVPoA';
const CLIENT_ID = '581804283346-ghfaimce7bjc9f7oj7f2lqai3q93pin0.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let accessToken = null;
let tokenClient = null;

/**
 * Initialize Google Drive integration
 */
function initGoogleDrive() {
    console.log('[DRIVE] Initializing Google Drive integration');
    
    // Initialize the token client
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.access_token) {
                    accessToken = response.access_token;
                    console.log('[DRIVE] Access token received successfully');
                    exibirPicker();
                } else if (response.error) {
                    console.error('[DRIVE] Error getting access token:', response.error);
                    alert('Erro ao autenticar com Google Drive: ' + response.error);
                }
            },
        });
    } else {
        console.error('[DRIVE] Google API not loaded');
    }
}

/**
 * Open Google Drive picker
 */
function abrirGoogleDrive() {
    console.log('[DRIVE] Opening Google Drive picker');
    
    if (!accessToken) {
        console.log('[DRIVE] No access token, requesting consent');
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            console.error('[DRIVE] Token client not initialized');
            alert('Erro: Google Drive não está disponível. Tente recarregar a página.');
        }
    } else {
        console.log('[DRIVE] Using existing access token');
        exibirPicker();
    }
}

/**
 * Display Google Drive picker
 */
function exibirPicker() {
    console.log('[DRIVE] Loading picker API');
    
    if (typeof gapi === 'undefined') {
        console.error('[DRIVE] GAPI not loaded');
        alert('Erro: API do Google não carregada. Tente recarregar a página.');
        return;
    }
    
    gapi.load('picker', () => {
        console.log('[DRIVE] Picker API loaded, creating picker');
        
        const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
            .setMimeTypes('audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/x-wav,audio/mpeg3,audio/x-mpeg-3')
            .setSelectFolderEnabled(false);

        const picker = new google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(accessToken)
            .setDeveloperKey(API_KEY)
            .setCallback(pickerCallback)
            .setTitle('Selecione arquivos de áudio do Google Drive')
            .setLocale('pt-BR')
            .build();

        picker.setVisible(true);
    });
}

/**
 * Handle picker callback
 */
async function pickerCallback(data) {
    console.log('[DRIVE] Picker callback received:', data.action);
    
    if (data.action === google.picker.Action.PICKED) {
        const docs = data.docs;
        console.log('[DRIVE] Files selected:', docs.length);
        
        // Process all selected files
        for (const doc of docs) {
            console.log('[DRIVE] Processing file:', doc.name, doc.id);
            await downloadDriveFile(doc);
        }
    } else if (data.action === google.picker.Action.CANCEL) {
        console.log('[DRIVE] Picker cancelled by user');
    }
}

/**
 * Download file from Google Drive
 */
async function downloadDriveFile(doc) {
    try {
        console.log('[DRIVE] Downloading file:', doc.name, 'ID:', doc.id);
        
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        console.log('[DRIVE] File downloaded successfully, size:', blob.size, 'type:', blob.type);
        
        // Create File object from blob
        const file = new File([blob], doc.name, { type: blob.type || 'audio/mpeg' });
        
        // Add to the existing import system
        if (window.currentApp && window.currentApp.handleAddTrackToPlayer) {
            console.log('[DRIVE] Adding file to player:', file.name);
            await window.currentApp.handleAddTrackToPlayer([file]);
            console.log('[DRIVE] File successfully added to player');
        } else {
            console.error('[DRIVE] App not available for file import');
            alert('Erro ao adicionar arquivo ao player. App não disponível.');
        }
        
    } catch (error) {
        console.error('[DRIVE] Error downloading file:', error);
        alert('Erro ao baixar arquivo do Google Drive: ' + error.message);
    }
}

/**
 * Reset access token (for logout)
 */
function resetGoogleDriveToken() {
    accessToken = null;
    console.log('[DRIVE] Access token reset');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Google APIs to load
    setTimeout(() => {
        initGoogleDrive();
        console.log('[DRIVE] Google Drive integration initialized');
    }, 1000);
});

// Expose functions globally
window.abrirGoogleDrive = abrirGoogleDrive;
window.resetGoogleDriveToken = resetGoogleDriveToken;