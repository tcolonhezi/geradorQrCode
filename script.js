const $ = id => document.getElementById(id);
const escapeWifiValue = value => value.replace(/([\\;,:"])/g, '\\$1');

function buildWifiPayload() {
  const encryptionType = $('enc').value;
  const networkName = $('ssid').value;
  const password = $('pw').value;

  let wifiString = 'WIFI:T:' + encryptionType + ';S:' + escapeWifiValue(networkName) + ';';
  if (encryptionType !== 'nopass') wifiString += 'P:' + escapeWifiValue(password) + ';';
  if ($('hidden').checked) wifiString += 'H:true;';

  return wifiString + ';';
}

function createQrCode() {
  const qrCode = qrcode(0, 'M');
  qrCode.addData(buildWifiPayload());
  qrCode.make();
  return qrCode;
}

function updatePreview() {
  const isOpenNetwork = $('enc').value === 'nopass';
  $('pwrow').style.display = isOpenNetwork ? 'none' : 'block';

  const networkName = $('ssid').value.trim();
  $('go').disabled = !networkName || (!isOpenNetwork && !$('pw').value);

  if (!networkName) {
    $('pc').innerHTML = '';
    return;
  }

  let qrCode;
  try {
    qrCode = createQrCode();
  } catch (error) {
    $('pc').textContent = 'Texto longo demais para o QR.';
    $('go').disabled = true;
    return;
  }

  const shouldShowPassword = $('showpw').checked && !isOpenNetwork;
  const previewCard = document.createElement('div');
  previewCard.innerHTML = '<b>Rede</b><span></span>' + qrCode.createSvgTag({cellSize: 4, margin: 0, scalable: true}) + (shouldShowPassword ? '<small></small>' : '');
  previewCard.querySelector('span').textContent = networkName;

  if (shouldShowPassword) previewCard.querySelector('small').textContent = 'Senha: ' + $('pw').value;

  $('pc').replaceChildren(...previewCard.childNodes);
}

function buildPdfDocument() {
  const {jsPDF} = window.jspdf;
  const pdfDocument = new jsPDF({unit: 'mm', format: 'a4'});
  const qrCode = createQrCode();
  const moduleCount = qrCode.getModuleCount();
  const networkName = $('ssid').value.trim();
  const isOpenNetwork = $('enc').value === 'nopass';
  const shouldShowPassword = $('showpw').checked && !isOpenNetwork;

  const cardWidth = 78;
  const cardHeight = 84;
  const gap = 8;
  const startX = (210 - 2 * cardWidth - gap) / 2;
  const startY = (297 - 3 * cardHeight - 2 * gap) / 2;
  const qrSide = 50;
  const cellSize = qrSide / moduleCount;

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 2; column++) {
      const x = startX + column * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      pdfDocument.setDrawColor(0);
      pdfDocument.setLineWidth(0.6);
      pdfDocument.roundedRect(x, y, cardWidth, cardHeight, 5, 5, 'S');
      pdfDocument.setTextColor(0);
      pdfDocument.setFont('helvetica', 'bold');
      pdfDocument.setFontSize(12);
      pdfDocument.text('Rede', x + cardWidth / 2, y + 10, {align: 'center'});
      pdfDocument.setFont('helvetica', 'normal');
      pdfDocument.setFontSize(11);
      pdfDocument.text(pdfDocument.splitTextToSize(networkName, cardWidth - 10)[0], x + cardWidth / 2, y + 16, {align: 'center'});

      const qrX = x + (cardWidth - qrSide) / 2;
      const qrY = y + 20;
      pdfDocument.setFillColor(0, 0, 0);

      for (let i = 0; i < moduleCount; i++) {
        for (let j = 0; j < moduleCount; j++) {
          if (qrCode.isDark(i, j)) {
            pdfDocument.rect(qrX + j * cellSize, qrY + i * cellSize, cellSize + 0.02, cellSize + 0.02, 'F');
          }
        }
      }

      if (shouldShowPassword) {
        pdfDocument.text(pdfDocument.splitTextToSize('Senha: ' + $('pw').value, cardWidth - 10)[0], x + cardWidth / 2, y + cardHeight - 7, {align: 'center'});
      } else if (isOpenNetwork) {
        pdfDocument.text('Rede aberta', x + cardWidth / 2, y + cardHeight - 7, {align: 'center'});
      }
    }
  }

  return pdfDocument;
}

async function generatePdf() {
  const messageBox = $('msg');
  messageBox.textContent = '';

  const pdfDocument = buildPdfDocument();
  const fileName = 'wifi-' + $('ssid').value.trim().replace(/[^\w-]+/g, '_') + '.pdf';

  let downloadHandler = null;
  try {
    downloadHandler = await claude.use('downloads');
  } catch (error) {
    // Sem handler de download disponível no ambiente atual.
  }

  if (downloadHandler) {
    try {
      await downloadHandler.save({filename: fileName, data: pdfDocument.output('blob')});
      messageBox.textContent = 'PDF pronto.';
    } catch (error) {
      messageBox.textContent = error && error.code === 'declined' ? 'Download cancelado.' : 'Não foi possível salvar o PDF.';
    }
  } else {
    try {
      pdfDocument.save(fileName);
      messageBox.textContent = 'PDF gerado.';
    } catch (error) {
      messageBox.textContent = 'Download indisponível neste ambiente.';
    }
  }
}

['ssid', 'pw', 'enc', 'hidden', 'showpw'].forEach(fieldId => $(fieldId).addEventListener('blur', updatePreview));
$('go').addEventListener('click', generatePdf);
updatePreview();
