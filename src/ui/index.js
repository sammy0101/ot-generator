import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

// 接收 userName 參數
export function getHtml(userName = '') {
    // 防止 undefined 或 null 變成字串 "undefined"
    const safeName = userName || '';
    
    return `
        ${htmlContent}
        <script>
            // === 關鍵：將後端的名字注入到前端變數 ===
            window.USER_NAME = "${safeName}";
            // ===================================
            
            ${logicScript}
            ${pdfScript}
        </script>
        </body>
        </html>
    `;
}
