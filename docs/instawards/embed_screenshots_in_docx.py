"""Append the proof-pack screenshots to a Writer document via LibreOffice UNO."""

from pathlib import Path
import sys
import struct
import uno


ROOT = Path(__file__).parent
SCREENSHOTS = [
    ("01-landing.png", "Screenshot 1 — Music City landing page"),
    ("02-player.png", "Screenshot 2 — Music playback controls"),
    ("03-login.png", "Screenshot 3 — User login and account access"),
    ("04-studio.png", "Screenshot 4 — Artist studio dashboard"),
    ("05-wallet.png", "Screenshot 5 — Artist account and Stellar wallet"),
    ("06-discovery.png", "Screenshot 6 — Music discovery and track catalog"),
    ("07-analytics.png", "Screenshot 7 — Artist analytics and stream health"),
]


def prop(name, value):
    value_property = uno.createUnoStruct("com.sun.star.beans.PropertyValue")
    value_property.Name = name
    value_property.Value = value
    return value_property


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as image:
        image.read(16)
        return struct.unpack(">II", image.read(8))


def main(input_path: str, output_path: str):
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local
    )
    context = resolver.resolve(
        "uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"
    )
    desktop = context.ServiceManager.createInstanceWithContext(
        "com.sun.star.frame.Desktop", context
    )
    document = desktop.loadComponentFromURL(
        uno.systemPathToFileUrl(str(Path(input_path).resolve())),
        "_blank",
        0,
        (prop("Hidden", True),),
    )
    text = document.Text
    cursor = text.createTextCursorByRange(text.End)
    text.insertString(cursor, "\nScreenshot Evidence\nMusic City live application: https://music-city.vercel.app/\n\n", False)

    for filename, caption in SCREENSHOTS:
        image_path = ROOT / "proof-pack-screenshots" / filename
        width_px, height_px = png_size(image_path)
        graphic = document.createInstance("com.sun.star.text.TextGraphicObject")
        graphic.AnchorType = uno.Enum(
            "com.sun.star.text.TextContentAnchorType", "AS_CHARACTER"
        )
        graphic.GraphicURL = uno.systemPathToFileUrl(str(image_path))
        graphic.Width = 15000
        graphic.Height = min(round(15000 * height_px / width_px), 17000)
        cursor = text.createTextCursorByRange(text.End)
        text.insertTextContent(cursor, graphic, False)
        cursor = text.createTextCursorByRange(text.End)
        text.insertString(cursor, f"\n{caption}\n\n", False)

    document.storeAsURL(
        uno.systemPathToFileUrl(str(Path(output_path).resolve())),
        (prop("FilterName", "Office Open XML Text"),),
    )
    document.close(True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
