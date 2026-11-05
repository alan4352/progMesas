# Exportar la carpeta del proyecto

La carpeta se escribe en Claude Docs y se exporta a Word (.docx). Estos dos scripts dejan el archivo listo para entregar:

1. `preparar.py` — la carátula queda sola en la primera página, el índice pasa a ser automático (con números de página),
   cada sección principal empieza en una hoja nueva, las filas de las tablas no se cortan y el pie lleva el número de
   página (la carátula no). Hoja A4.
2. `actualizar.py` — abre el archivo con LibreOffice, actualiza el índice y guarda el .docx y el .pdf.

```
python3 preparar.py exportado.docx preparada.docx
python3 actualizar.py "$PWD/preparada.docx" "$PWD/Carpeta.docx" "$PWD/Carpeta.pdf"
```

Hace falta LibreOffice con su módulo de Python (`import uno`).
