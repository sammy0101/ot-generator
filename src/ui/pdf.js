export const pdfScript = `
    async function generatePDF() {
        if(currentRecords.length === 0) return;
        const btn = document.getElementById('pdfBtn');
        const originalText = btn.innerText;
        
        btn.innerText = "載入字型與生成中... (請稍候)"; 
        btn.disabled = true;
        
        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            // === 獲取純文字字型並還原 ===
            const fontUrl = '/api/font'; 

            const fontRes = await fetch(fontUrl);
            if (!fontRes.ok) {
                const errText = await fontRes.text();
                throw new Error(\`字型載入失敗: \${errText}\`);
            }
            
            // 拿到 Base64 純文字
            const b64String = await fontRes.text();
            
            if (b64String.includes("<!DOC") || b64String.includes("<html")) {
                throw new Error("下載到無效的字型檔案，請確認 GitHub Actions 是否部署成功。");
            }

            // 在瀏覽器端將 Base64 轉換回二進位陣列
            const binaryString = window.atob(b64String);
            const len = binaryString.length;
            const fontBytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                fontBytes[i] = binaryString.charCodeAt(i);
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
            const colorBlue = rgb(0.38, 0.4, 0.94); // 藍色主題色 (對應網頁端 indigo-400)

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
                    detailStr = r.start.replace(':', '') + ' - ' + r.end.replace(':', '');
                    const mul = r.multiplier || 1;
                    const effectiveMins = mins * mul;
                    valStr = formatHours(effectiveMins) + ' hr';
                    if (mul > 1) valStr += ' (x' + mul + ')';
                    rowColor = colorBlue;
                } else if (r.type === 'transport') {
                    itemStr = '交通費';
                    detailStr = r.location ? r.location : '-';
                    detailFont = chineseFont; 
                    valStr = '$' + amount;
                    rowColor = colorOrange;
                } else if (r.type === 'oncall') {
                    itemStr = '當更 On-Call';
                    const startD = r.date.split('-')[2];
                    const endD = r.endDate ? r.endDate.split('-')[2] : '';
                    detailStr = startD + '日 - ' + endD + '日';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                } else { 
                    itemStr = 'Call';
                    detailStr = r.location ? r.location : '-';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                }

                drawTxt(r.date, col.d, helvetica);
                const safeItem = itemStr.length > 20 ? itemStr.substring(0,19)+'...' : itemStr;
                
                // === 已優化調整：將項目欄位（safeItem）也帶入與金額相同的 rowColor，實現統一上色 ===
                drawTxt(safeItem, col.item, chineseFont, rowColor);
                
                drawTxt(detailStr, col.detail, detailFont);
                drawTxt(valStr, col.val, helveticaBold, rowColor);

                page.drawLine({ start: { x: marginX, y: yPos-8 }, end: { x: width-marginX, y: yPos-8 }, thickness: 0.5, color: rgb(0.9,0.9,0.9) });
                yPos -= 25;
                
                if (yPos < 50) { pdfDoc.addPage([595.28, 841.89]); yPos = height - 50; }
            }

            yPos -= 10;
            page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 1 });
            yPos -= 25;

            // === 依據您的指定，重新安排 PDF 底部統計區塊的輸出順序 ===
            
            // 1. 總當更/Call
            drawTxt("總當更/Call: ", 350, chineseFont);
            drawTxt("$" + grandTotalMoney, 440, helveticaBold, colorGreen);
            yPos -= 20;

            // 2. 總交通
            drawTxt("總交通: ", 350, chineseFont);
            drawTxt("$" + grandTotalTransport, 440, helveticaBold, colorOrange);
            yPos -= 15;

            // 3. 統計小分隔線
            page.drawLine({ start: { x: 350, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 0.5, color: rgb(0.7,0.7,0.7) });
            yPos -= 20;

            // 4. 總計 (含交通)
            drawTxt("總計 (含交通): ", 350, chineseFont); 
            const totalAll = grandTotalMoney + grandTotalTransport;
            drawTxt("$" + totalAll, 440, helveticaBold, colorBlack); 
            yPos -= 20;

            // 5. 總時數
            drawTxt("總時數: ", 350, chineseFont);
            drawTxt(formatHours(grandTotalMinutes) + " hr", 440, helveticaBold, colorBlue);

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            let filename = 'OT_Record_' + monthStr + '.pdf';
            if (window.USER_NAME) filename = 'OT_Record_' + monthStr + '_' + window.USER_NAME + '.pdf';
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
