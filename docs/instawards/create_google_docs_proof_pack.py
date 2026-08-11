"""Create a Google Docs-compatible .docx version of the Music City proof pack."""

from pathlib import Path
from xml.sax.saxutils import escape
import struct
import zipfile


ROOT = Path(__file__).parent
OUTPUT = ROOT / "music-city-instawards-proof-pack-google-docs.docx"
SCREENSHOTS = [
    ("01-landing.png", "Screenshot 1 — Music City landing page"),
    ("02-player.png", "Screenshot 2 — Music playback controls"),
    ("03-login.png", "Screenshot 3 — User login and account access"),
    ("04-studio.png", "Screenshot 4 — Artist studio dashboard"),
    ("05-wallet.png", "Screenshot 5 — Artist account and Stellar wallet"),
    ("06-discovery.png", "Screenshot 6 — Music discovery and track catalog"),
    ("07-analytics.png", "Screenshot 7 — Artist analytics and stream health"),
]


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as image:
        image.read(16)
        return struct.unpack(">II", image.read(8))


def paragraph(text="", bold=False, size=None, style=None, page_break=False):
    properties = f'<w:pStyle w:val="{style}"/>' if style else ""
    if page_break:
        properties += '<w:pageBreakBefore/>'
    run_properties = ""
    if bold:
        run_properties += "<w:b/>"
    if size:
        run_properties += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    return (
        f'<w:p><w:pPr>{properties}</w:pPr><w:r><w:rPr>{run_properties}</w:rPr>'
        f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
    )


def image_paragraph(rel_id: str, filename: str, width_px: int, height_px: int, index: int):
    width = 5_943_600  # 6.5 inches
    height = min(round(width * height_px / width_px), 5_900_000)
    return f'''<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
 <wp:extent cx="{width}" cy="{height}"/><wp:docPr id="{index}" name="{filename}"/>
 <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
 <pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="{filename}"/><pic:cNvPicPr/></pic:nvPicPr>
 <pic:blipFill><a:blip r:embed="{rel_id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
 <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{width}" cy="{height}"/></a:xfrm>
 <a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>
 </a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'''


def build_document():
    parts = [
        paragraph("Music City", bold=True, size=40),
        paragraph("Instawards Delivery Summary", size=24),
        paragraph("Builder: Enoch N. Chirima    |    Chapter: Southern Africa"),
        paragraph("Live application: https://music-city.vercel.app/"),
        paragraph("Delivered Items", bold=True, size=28),
    ]
    delivered = [
        "Stellar wallet connection and authentication",
        "Artist onboarding, artist profiles, and track management",
        "Music upload, media processing, and secure streaming playback",
        "Listener music catalog, subscription access, and streaming interface",
        "Subscription access control and qualified-stream tracking",
        "Royalty splits, royalty ledger, and admin payout controls",
        "Soroban royalty-split smart contract deployed to Stellar Testnet",
        "Music City publishing and on-chain verification of royalty splits",
        "Application and smart-contract test suites",
    ]
    parts.extend(paragraph(f"• {item}") for item in delivered)
    parts += [
        paragraph("Verification Links", bold=True, size=28),
        paragraph("Live application: https://music-city.vercel.app/"),
        paragraph("Source repository: https://github.com/music-city/music-city"),
        paragraph("Deployed Soroban contract: CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3"),
        paragraph("Contract page: https://stellar.expert/explorer/testnet/contract/CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3"),
        paragraph("Music City treasury address: GCW3HD5EBMVNBGOWCPTP3WNYXXT5OYB2UIMKDNSL3IZRGLVMU4OEKFWO"),
        paragraph("Contract deployment transaction: c313274db1575c8c018dd2646e4e388e9a2794b0d21f738fbe55fc7e500b75d6"),
        paragraph("Deployment transaction: https://stellar.expert/explorer/testnet/tx/c313274db1575c8c018dd2646e4e388e9a2794b0d21f738fbe55fc7e500b75d6"),
        paragraph("Screenshot Evidence", bold=True, size=28, page_break=True),
        paragraph("Music City live application: https://music-city.vercel.app/"),
    ]
    for index, (filename, caption) in enumerate(SCREENSHOTS, 1):
        image_path = ROOT / "proof-pack-screenshots" / filename
        width, height = png_size(image_path)
        parts.append(image_paragraph(f"rId{index}", filename, width, height, index))
        parts.append(paragraph(caption, bold=True))
    parts.append('''<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>''')
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>{''.join(parts)}</w:body></w:document>'''


def main():
    relationships = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ]
    for index, (filename, _) in enumerate(SCREENSHOTS, 1):
        relationships.append(
            f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{filename}"/>'
        )
    relationships.append("</Relationships>")
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as document:
        document.writestr("[Content_Types].xml", '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>''')
        document.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>''')
        document.writestr("word/document.xml", build_document())
        document.writestr("word/_rels/document.xml.rels", "".join(relationships))
        for filename, _ in SCREENSHOTS:
            document.write(ROOT / "proof-pack-screenshots" / filename, f"word/media/{filename}")
    print(OUTPUT)


if __name__ == "__main__":
    main()
