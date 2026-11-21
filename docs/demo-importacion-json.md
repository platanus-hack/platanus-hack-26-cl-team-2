# Importar una empresa DEMO desde JSON

En DEMO mode, descarga la plantilla, edita sus datos y selecciona el archivo
JSON. La aplicación valida el contenido antes de ofrecer una vista previa.
Pulsa **Aplicar JSON al formulario** para reemplazar los campos editables.
Revisa los datos y usa el botón de guardado de DEMO para persistirlos.
Cancelar o cargar un archivo inválido no modifica el formulario.

```json
{
  "companyName": "NexusB1",
  "context": "Contexto compartido de la empresa de prueba.",
  "agents": [
    { "name": "Soporte", "prompt": "Diagnostica incidencias de sincronización." },
    { "name": "Onboarding", "prompt": "Valida la configuración del conector." }
  ],
  "files": [
    {
      "filename": "conectores.txt",
      "label": "Configuración de prueba",
      "content": "Cliente DEMO-001: Shopify → SAP B1.",
      "readAgentNames": ["Soporte", "Onboarding"],
      "writeAgentNames": ["Onboarding"]
    }
  ]
}
```

`agents` representa los usuarios/agentes de la simulación. Incluye entre 1 y 24,
con nombres únicos de hasta 64 caracteres y prompts de hasta 12000 caracteres.
`context` es obligatorio y admite hasta 20000 caracteres. `companyName` admite
hasta 120 caracteres. `files` es opcional; omitirlo deja el formulario sin archivos.
Los permisos deben referenciar nombres de agentes incluidos en el mismo JSON.

El archivo JSON admite hasta 5 MB, con hasta 24 archivos .txt de 200000 caracteres
cada uno. Usa nombres sin carpetas ni espacios. No se asignan permisos a agentes
que no estén declarados. La importación no llama a modelos ni ejecuta herramientas.
