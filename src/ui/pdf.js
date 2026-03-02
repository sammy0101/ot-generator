export const pdfScript = `
    async function generatePDF() {
        if(currentRecords.length === 0) return;
        const btn = document.getElementById('pdfBtn');
        const originalText = btn.innerText;
        
        btn.innerText = "下載字型與生成中... (首次需約 5-10 秒)"; 
        btn.disabled = true;
        
        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            // === 透過前端陣列列出多個穩定 TTF 字型來源 ===
            const fontUrls =[
                // 1. 最穩定的 NPM 鏡像 (jsDelivr)
                'https://cdn.jsdelivr.net/npm/open-huninn-font@1.1.0/jf-openhuninn-1.1.ttf',
                // 2. 最穩定的 NPM 鏡像 (unpkg)
                'https://unpkg.com/open-huninn-font@1.1.0/jf-openhuninn-1.1.ttf',
                // 3. 您之前提供的第三方鏡像備用
                'https://gh.registry.cyou/justfont/open-huninn-font/releases/download/v2.1/jf-openhuninn-2.1.ttf'
            ];

            let fontBytes = null;

            // 輪詢測試 CDN，只要一個成功就跳出
            for (const url of fontUrls) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) continue; // 如果 404 就換下一個
                    fontBytes = await res.arrayBuffer();
                    
                    // 確保抓下來的不是錯誤的 HTML 網頁
                    const headStr = new TextDecoder().decode(fontBytes.slice(0, 10));
                    if (headStr.includes("<!DOC") || headStr.includes("<html")) continue;
                    
                    break; // 成功！
                } catch (e) {
                    console.warn(\`字型來源失效 (\${url})\`);
                }
            }

            if (!fontBytes) {
                throw new Error("所有字型伺服器皆無法連線，請檢查網路。");
            }

            const chineseFont = await pdfDoc.embedFont(fontBytes);
            // ============================================

            const page = pdfDoc.addPage([595.28, 841.89]);
            const { width, height } = page.getSize();
            let yPos = height - 60;
            const marginX = 40;

            const colorBlack = rgb(0, 0, 0);
            const colorGreen = rgb(0, 0.5, 0);
            const colorOrange = rgb(0.85, 0.5, 0);

            const monthStr = document.getElementById('queryMonth').value;
            page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
            page.drawText(' OT/當更/交通 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
            
            if (window.USER_NAME) {
                const nameText = window.USER_NAME;
                const nameWidth = chineseFont.widthOfTextAtSize(nameText, 14);
                page.drawText(nameText, { x: width - marginX - nameWidth, y: yPos, size: 14, font: chineseFont, color: rgb(0.3, 0.3, 0.3) });
            }

            yPos -= 40;

            const col = { d: 40, item: 130, detail: 350, val: 480 };
            const fontSize = 11;
            const drawTxt = (text, x, font, color=colorBlack) => page.drawText(text, { x, y: yPos, size: fontSize, font, color });

            drawTxt('日期', col.d, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('項目/地點', col.item, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時數/金額', col.val, chineseFont, rgb(0.5,0.5,0.5));
            
            page.drawLine({ start: { x: marginX, y: yPos-5 }, end: { x: width-marginX, y: yPos-5 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
            yPos -= 25;

            for (const r of currentRecords) {
                const amount = Number(r.amount) || 0; 
                if (r.type !== 'hourly' && amount === 0) continue;

                let itemStr = '', detailStr = '', valStr = '';
                let detailFont = helvetica; 
                let rowColor = colorBlack;

                if (r.type === 'hourly') {
                    itemStr = r.location || 'OT';
                    const mins = getMinutesDiff(r.start, r.end);
                    detailStr = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                    const mul = r.multiplier || 1;
                    const effectiveMins = mins * mul;
                    valStr = formatHours(effectiveMins) + ' hr';
                    if (mul > 1) valStr += \` (x\${mul})\`;
                    rowColor = colorBlack;
                } else if (r.type === 'transport') {
                    itemStr = '交通費';
                    detailStr = r.location ? \`(\${r.location})\` : '-';
                    detailFont = chineseFont; 
                    valStr = '$' + amount;
                    rowColor = colorOrange;
                } else if (r.type === 'oncall') {
                    itemStr = '當更 On-Call';
                    const startD = r.date.split('-')[2];
                    const endD = r.endDate ? r.endDate.split('-')[2] : '';
                    detailStr = \`\${startD}日 - \${endD}日\`;
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                } else { 
                    itemStr = 'Call';
                    detailStr = r.location ? \`(\${r.location})\` : '-';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                }

                drawTxt(r.date, col.d, helvetica);
                const safeItem = itemStr.length > 20 ? itemStr.substring(0,19)+'...' : itemStr;
                drawTxt(safeItem, col.item, chineseFont);
                drawTxt(detailStr, col.detail, detailFont);
                drawTxt(valStr, col.val, helveticaBold, rowColor);

                page.drawLine({ start: { x: marginX, y: yPos-8 }, end: { x: width-marginX, y: yPos-8 }, thickness: 0.5, color: rgb(0.9,0.9,0.9) });
                yPos -= 25;
                
                if (yPos < 50) { pdfDoc.addPage([595.28, 841.89]); yPos = height - 50; }
            }

            yPos -= 10;
            page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 1 });
            yPos -= 25;

            drawTxt("總時數: ", 350, chineseFont);
            drawTxt(formatHours(grandTotalMinutes) + " hr", 410, helveticaBold);
            yPos -= 20;

            drawTxt("總收入: ", 350, chineseFont);
            drawTxt("$" + grandTotalMoney, 410, helveticaBold, colorGreen);
            yPos -= 20;

            drawTxt("總交通: ", 350, chineseFont);
            drawTxt("$" + grandTotalTransport, 410, helveticaBold, colorOrange);
            yPos -= 20;

            const totalAll = grandTotalMoney + grandTotalTransport;
            drawTxt("總計:", 350, chineseFont); 
            drawTxt("$" + totalAll, 410, helveticaBold, colorBlack); 
            
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            let filename = \`OT_Record_\${monthStr}.pdf\`;
            if (window.USER_NAME) filename = \`OT_Record_\${monthStr}_\${window.USER_NAME}.pdf\`;
            link.download = filename;
            
            link.click();

        } catch(err) { 
            console.error(err); 
            alert("生成失敗: " + err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = originalText; 
        }
    }
`;
