"""Extract text from the Mess Menu PDF."""
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF not installed. Trying pdfplumber...")
    try:
        import pdfplumber
        if len(sys.argv) < 2:
            print("Usage: python extract_pdf.py <path_to_pdf>")
            sys.exit(1)
        pdf_path = sys.argv[1]
        with pdfplumber.open(pdf_path) as pdf:
            print(f"Pages: {len(pdf.pages)}")
            for i, page in enumerate(pdf.pages):
                print(f"\n{'='*80}")
                print(f"--- Page {i+1} ---")
                print(f"{'='*80}")
                text = page.extract_text()
                if text:
                    print(text)
                else:
                    print("[No text extracted from this page]")
                    # Try extracting tables
                    tables = page.extract_tables()
                    if tables:
                        for ti, table in enumerate(tables):
                            print(f"\n  Table {ti+1}:")
                            for row in table:
                                print("  | " + " | ".join(str(c) if c else "" for c in row) + " |")
        sys.exit(0)
    except ImportError:
        print("Neither PyMuPDF nor pdfplumber installed.")
        sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python extract_pdf.py <path_to_pdf>")
    sys.exit(1)
pdf_path = sys.argv[1]
doc = fitz.open(pdf_path)
print(f"Pages: {len(doc)}")
for i in range(len(doc)):
    print(f"\n{'='*80}")
    print(f"--- Page {i+1} ---")
    print(f"{'='*80}")
    print(doc[i].get_text())
doc.close()
