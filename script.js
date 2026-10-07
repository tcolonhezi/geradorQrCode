const $ = (id) => document.getElementById(id);
const escapeWifiValue = (value) => value.replace(/([\\;,:"])/g, "\\$1");

/*
 * Todas as posições são frações do cartão:
 *   x, w, cx, side  -> fração da LARGURA
 *   y, cy           -> fração da ALTURA
 * fontPx = altura da fonte medida na imagem original (cartão com 1025px de altura).
 */
const TEMPLATES = {
  1: {
    name: "Corporativo / Moderno",
    img: "templates/wifi-modelo-1.png",
    ratio: 424 / 1025,
    qr: { cx: 0.505, cy: 0.562, side: 0.557 },
    rede: { x: 0.236, y: 0.808, w: 0.248 },
    senha: { x: 0.55, y: 0.808, w: 0.377 },
    fontPx: 24,
    color: [255, 255, 255],
  },
  2: {
    name: "Minimalista / Clean",
    img: "templates/wifi-modelo-2.png",
    ratio: 424 / 1025,
    qr: { cx: 0.498, cy: 0.574, side: 0.566 },
    rede: { x: 0.196, y: 0.82, w: 0.25 },
    senha: { x: 0.606, y: 0.82, w: 0.354 },
    fontPx: 24,
    color: [17, 17, 17],
  },
  3: {
    name: "Supermercado / Amigável",
    img: "templates/wifi-modelo-3.png",
    ratio: 429 / 1025,
    qr: { cx: 0.499, cy: 0.544, side: 0.55 },
    rede: { x: 0.114, y: 0.836, w: 0.338 },
    senha: { x: 0.531, y: 0.836, w: 0.373 },
    fontPx: 28,
    color: [18, 51, 127],
  },
};

const imageCache = {};

function loadImageDataUrl(url) {
  if (!imageCache[url]) {
    imageCache[url] = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Imagem não encontrada: " + url);
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = reject;
            fileReader.readAsDataURL(blob);
          }),
      );
  }

  return imageCache[url];
}

const getTplValue = () =>
  document.querySelector('input[name="tpl"]:checked')?.value || "simple";

const isSimpleTemplateSelected = () => getTplValue() === "simple";

function getTemplate() {
  return TEMPLATES[getTplValue()] || TEMPLATES["1"];
}

function buildWifiPayload() {
  const encryptionType = $("enc").value;
  const networkName = $("ssid").value;
  const password = $("pw").value;

  let wifiString =
    "WIFI:T:" + encryptionType + ";S:" + escapeWifiValue(networkName) + ";";
  if (encryptionType !== "nopass")
    wifiString += "P:" + escapeWifiValue(password) + ";";
  if ($("hidden").checked) wifiString += "H:true;";

  return wifiString + ";";
}

function createQrCode() {
  const qrCode = qrcode(0, "M");
  qrCode.addData(buildWifiPayload());
  qrCode.make();
  return qrCode;
}

// Texto que vai no campo "Senha" do modelo
function getPasswordText() {
  const isOpenNetwork = $("enc").value === "nopass";
  if (isOpenNetwork) return "Rede aberta";
  return $("showpw").checked ? $("pw").value : "—";
}

function updatePreview() {
  const isOpenNetwork = $("enc").value === "nopass";
  $("pwrow").style.display = isOpenNetwork ? "none" : "block";

  const networkName = $("ssid").value.trim();
  $("go").disabled = !networkName || (!isOpenNetwork && !$("pw").value);

  if (!networkName) {
    $("pc").innerHTML = "";
    return;
  }

  let qrCode;
  try {
    qrCode = createQrCode();
  } catch (error) {
    $("pc").textContent = "Texto longo demais para o QR.";
    $("go").disabled = true;
    return;
  }

  if (isSimpleTemplateSelected()) {
    const shouldShowPassword = $("showpw").checked && !isOpenNetwork;
    const previewCard = document.createElement("div");
    previewCard.innerHTML =
      "<b>Rede</b><span></span>" +
      qrCode.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) +
      (shouldShowPassword ? "<small></small>" : "");
    previewCard.querySelector("span").textContent = networkName;
    if (shouldShowPassword)
      previewCard.querySelector("small").textContent =
        "Senha: " + $("pw").value;
    $("pc").replaceChildren(...previewCard.childNodes);
    return;
  }

  const selectedTemplate = getTemplate();
  const imageWidthPixels = selectedTemplate.ratio * 1025;
  const toPercentage = (value) => (value * 100).toFixed(3) + "%";
  const templateColor = "rgb(" + selectedTemplate.color.join(",") + ")";

  const card = document.createElement("div");
  card.style.cssText =
    "position:relative;width:100%;max-width:220px;container-type:inline-size;line-height:1;";

  const backgroundImage = document.createElement("img");
  backgroundImage.src = selectedTemplate.img;
  backgroundImage.style.cssText = "display:block;width:100%;height:auto;";
  card.appendChild(backgroundImage);

  const qrContainer = document.createElement("div");
  qrContainer.style.cssText =
    "position:absolute;left:" +
    toPercentage(selectedTemplate.qr.cx - selectedTemplate.qr.side / 2) +
    ";width:" +
    toPercentage(selectedTemplate.qr.side) +
    ";";
  qrContainer.style.top = toPercentage(
    selectedTemplate.qr.cy -
      (selectedTemplate.qr.side * selectedTemplate.ratio) / 2,
  );
  qrContainer.innerHTML = qrCode.createSvgTag({
    cellSize: 4,
    margin: 0,
    scalable: true,
  });
  const svg = qrContainer.querySelector("svg");
  if (svg) {
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
  }
  card.appendChild(qrContainer);

  const addText = (textArea, textContent) => {
    const maximumPixels = selectedTemplate.fontPx;
    const fittedSize = Math.min(
      maximumPixels,
      (textArea.w * imageWidthPixels) /
        (Math.max(textContent.length, 1) * 0.58),
    );
    const textElement = document.createElement("div");
    textElement.textContent = textContent;
    textElement.style.cssText =
      "position:absolute;white-space:nowrap;overflow:hidden;font-weight:700;" +
      "font-family:Helvetica,Arial,sans-serif;color:" +
      templateColor +
      ";" +
      "left:" +
      toPercentage(textArea.x) +
      ";top:" +
      toPercentage(textArea.y) +
      ";width:" +
      toPercentage(textArea.w) +
      ";" +
      "font-size:" +
      ((fittedSize / imageWidthPixels) * 100).toFixed(3) +
      "cqw;" +
      "transform:translateY(-100%);";
    card.appendChild(textElement);
  };

  addText(selectedTemplate.rede, networkName);
  addText(selectedTemplate.senha, getPasswordText());

  $("pc").replaceChildren(card);
}

function drawFittedText(pdfDocument, text, x, y, maxWidth, startSize) {
  let fontSize = startSize;
  pdfDocument.setFontSize(fontSize);
  while (pdfDocument.getTextWidth(text) > maxWidth && fontSize > 5) {
    fontSize -= 0.5;
    pdfDocument.setFontSize(fontSize);
  }
  pdfDocument.text(text, x, y);
}

function buildSimplePdf(pdfDocument) {
  const qrCode = createQrCode();
  const moduleCount = qrCode.getModuleCount();
  const networkName = $("ssid").value.trim();
  const isOpenNetwork = $("enc").value === "nopass";
  const shouldShowPassword = $("showpw").checked && !isOpenNetwork;

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
      pdfDocument.roundedRect(x, y, cardWidth, cardHeight, 5, 5, "S");
      pdfDocument.setTextColor(0);
      pdfDocument.setFont("helvetica", "bold");
      pdfDocument.setFontSize(12);
      pdfDocument.text("Rede", x + cardWidth / 2, y + 10, { align: "center" });
      pdfDocument.setFont("helvetica", "normal");
      pdfDocument.setFontSize(11);
      pdfDocument.text(
        pdfDocument.splitTextToSize(networkName, cardWidth - 10)[0],
        x + cardWidth / 2,
        y + 16,
        { align: "center" },
      );

      const qrX = x + (cardWidth - qrSide) / 2;
      const qrY = y + 20;
      pdfDocument.setFillColor(0, 0, 0);

      for (let i = 0; i < moduleCount; i++) {
        for (let j = 0; j < moduleCount; j++) {
          if (qrCode.isDark(i, j)) {
            pdfDocument.rect(
              qrX + j * cellSize,
              qrY + i * cellSize,
              cellSize + 0.02,
              cellSize + 0.02,
              "F",
            );
          }
        }
      }

      if (shouldShowPassword) {
        pdfDocument.text(
          pdfDocument.splitTextToSize(
            "Senha: " + $("pw").value,
            cardWidth - 10,
          )[0],
          x + cardWidth / 2,
          y + cardHeight - 7,
          { align: "center" },
        );
      } else if (isOpenNetwork) {
        pdfDocument.text("Rede aberta", x + cardWidth / 2, y + cardHeight - 7, {
          align: "center",
        });
      }
    }
  }
  return pdfDocument;
}

async function buildPdfDocument() {
  const { jsPDF } = window.jspdf;
  const pdfDocument = new jsPDF({ unit: "mm", format: "a4" });

  if (isSimpleTemplateSelected()) return buildSimplePdf(pdfDocument);

  const selectedTemplate = getTemplate();
  const backgroundImageData = await loadImageDataUrl(selectedTemplate.img);

  const qrCode = createQrCode();
  const moduleCount = qrCode.getModuleCount();
  const networkName = $("ssid").value.trim();
  const passwordText = getPasswordText();

  // 3 colunas x 2 linhas de cartões altos (6 por folha)
  const cardHeight = 135;
  const cardWidth = cardHeight * selectedTemplate.ratio;
  const columns = 3;
  const rows = 2;
  const gap = 8;
  const startX = (210 - columns * cardWidth - (columns - 1) * gap) / 2;
  const startY = (297 - rows * cardHeight - (rows - 1) * gap) / 2;

  const qrSide = selectedTemplate.qr.side * cardWidth;
  const cellSize = qrSide / moduleCount;
  const fontPoint = (selectedTemplate.fontPx * cardHeight) / 1025 / 0.3528;

  pdfDocument.setFont("helvetica", "bold");
  pdfDocument.setTextColor(
    selectedTemplate.color[0],
    selectedTemplate.color[1],
    selectedTemplate.color[2],
  );

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = startX + column * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      pdfDocument.addImage(
        backgroundImageData,
        "PNG",
        x,
        y,
        cardWidth,
        cardHeight,
        undefined,
        "FAST",
      );

      const qrX = x + selectedTemplate.qr.cx * cardWidth - qrSide / 2;
      const qrY = y + selectedTemplate.qr.cy * cardHeight - qrSide / 2;
      pdfDocument.setFillColor(0, 0, 0);

      for (let matrixRow = 0; matrixRow < moduleCount; matrixRow++) {
        for (let matrixColumn = 0; matrixColumn < moduleCount; matrixColumn++) {
          if (qrCode.isDark(matrixRow, matrixColumn)) {
            pdfDocument.rect(
              qrX + matrixColumn * cellSize,
              qrY + matrixRow * cellSize,
              cellSize + 0.02,
              cellSize + 0.02,
              "F",
            );
          }
        }
      }

      pdfDocument.setFont("helvetica", "bold");
      pdfDocument.setTextColor(
        selectedTemplate.color[0],
        selectedTemplate.color[1],
        selectedTemplate.color[2],
      );

      drawFittedText(
        pdfDocument,
        networkName,
        x + selectedTemplate.rede.x * cardWidth,
        y + selectedTemplate.rede.y * cardHeight,
        selectedTemplate.rede.w * cardWidth,
        fontPoint,
      );
      drawFittedText(
        pdfDocument,
        passwordText,
        x + selectedTemplate.senha.x * cardWidth,
        y + selectedTemplate.senha.y * cardHeight,
        selectedTemplate.senha.w * cardWidth,
        fontPoint,
      );
    }
  }

  return pdfDocument;
}

async function generatePdf() {
  const messageBox = $("msg");
  messageBox.textContent = "";

  let pdfDocument;
  try {
    pdfDocument = await buildPdfDocument();
  } catch (error) {
    messageBox.textContent =
      "Não foi possível carregar o modelo: " + error.message;
    return;
  }
  const fileName =
    "wifi-" +
    $("ssid")
      .value.trim()
      .replace(/[^\w-]+/g, "_") +
    ".pdf";

  try {
    if (window.showSaveFilePicker) {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          { description: "PDF", accept: { "application/pdf": [".pdf"] } },
        ],
      });

      const fileBlob = pdfDocument.output("blob");
      const writableStream = await fileHandle.createWritable();
      await writableStream.write(fileBlob);
      await writableStream.close();
      messageBox.textContent = "PDF pronto.";
      return;
    }

    pdfDocument.save(fileName);
    messageBox.textContent = "PDF gerado.";
  } catch (error) {
    messageBox.textContent =
      error && error.name === "AbortError"
        ? "Download cancelado."
        : "Não foi possível salvar o PDF.";
  }
}

["ssid", "pw", "enc", "hidden", "showpw"].forEach((fieldId) =>
  $(fieldId).addEventListener("blur", updatePreview),
);
document
  .querySelectorAll('input[name="tpl"]')
  .forEach((radio) => radio.addEventListener("change", updatePreview));

$("go").addEventListener("click", generatePdf);
updatePreview();
