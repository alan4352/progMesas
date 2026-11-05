"""Prepara la carpeta: carátula sola, índice automático (TOC) y número de página en el pie."""
import re, sys, zipfile, shutil

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
files = {n: zin.read(n) for n in zin.namelist()}
doc = files['word/document.xml'].decode('utf-8')

paras = re.findall(r'<w:p>.*?</w:p>|<w:p .*?</w:p>|<w:tbl>.*?</w:tbl>', doc, flags=re.S)
body_start = doc.index('<w:body>') + len('<w:body>')
body_end = doc.index('<w:sectPr>')
body = doc[body_start:body_end]

PB = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def texto(p):
    return ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p))

# 1) Carátula: el encabezado "Carátula" deja de ser título; la carátula va centrada y sola en su página
body = body.replace('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">Carátula</w:t></w:r></w:p>', '', 1)

# 2) Índice: se reemplaza la lista por un índice automático con números de página
i_ind = body.index('<w:t xml:space="preserve">Índice</w:t>')
p_ind_start = body.rfind('<w:p>', 0, i_ind)
p_ind_end = body.index('</w:p>', i_ind) + len('</w:p>')
i_pres = body.index('<w:t xml:space="preserve">1. Presentación del proyecto</w:t>')
p_pres_start = body.rfind('<w:p>', 0, i_pres)
# párrafo de la regla horizontal antes del índice
hr = '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>'
caratula = body[:p_ind_start].replace(hr, '')
toc = (
    PB +
    '<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:outlineLvl w:val="9"/></w:pPr><w:r><w:t xml:space="preserve">Índice</w:t></w:r></w:p>'
    '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
    '<w:r><w:instrText xml:space="preserve"> TOC \\o "2-3" \\h \\z \\u </w:instrText></w:r>'
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
    '<w:r><w:t>Actualizar el índice para ver los números de página.</w:t></w:r>'
    '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
)
resto = body[p_pres_start:]

# 3) Carátula centrada y con aire
def centrar(p):
    if '<w:pPr></w:pPr>' in p:
        return p.replace('<w:pPr></w:pPr>', '<w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr>', 1)
    if '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' in p:
        return p.replace('<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>', '<w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/><w:spacing w:before="2400" w:after="1200"/><w:outlineLvl w:val="9"/></w:pPr>', 1)
    return p
caratula = ''.join(centrar(p) for p in re.findall(r'<w:p>.*?</w:p>', caratula, flags=re.S))

# 4) Cada sección principal (Heading2) empieza en una página nueva
resto = resto.replace('<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>', '<w:pPr><w:pStyle w:val="Heading2"/><w:pageBreakBefore/></w:pPr>')

body = caratula + toc + resto

# 5b) Las filas de las tablas no se cortan entre dos páginas
body = body.replace('<w:tr><w:tc>', '<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc>')
body = body.replace('<w:trPr><w:tblHeader/>', '<w:trPr><w:cantSplit/><w:tblHeader/>')

# 5) Pie de página con el número (la carátula sin número), hoja A4
footer = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
          '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')
footer_vacio = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>')
files['word/footer1.xml'] = footer.encode()
files['word/footer2.xml'] = footer_vacio.encode()
rels = files['word/_rels/document.xml.rels'].decode()
rels = rels.replace('</Relationships>',
    '<Relationship Id="rIdPie1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
    '<Relationship Id="rIdPie2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/></Relationships>')
files['word/_rels/document.xml.rels'] = rels.encode()
ct = files['[Content_Types].xml'].decode()
ct = ct.replace('</Types>',
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
    '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
files['[Content_Types].xml'] = ct.encode()
sect = ('<w:sectPr><w:footerReference w:type="default" r:id="rIdPie1"/><w:footerReference w:type="first" r:id="rIdPie2"/>'
        '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/>'
        '<w:titlePg/></w:sectPr>')
doc = doc[:body_start] + body + sect + '</w:body></w:document>'
files['word/document.xml'] = doc.encode('utf-8')

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for n, b in files.items():
        z.writestr(n, b)
print('ok', len(body))
