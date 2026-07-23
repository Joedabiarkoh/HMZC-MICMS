/// <reference types="vite/client" />
// Added alongside the Inspections/Certificates module: Finance never
// imported a CSS file, so this project had no need for Vite's client
// types (which declare `*.css` imports and `import.meta.env`) until now.
// inspections.css is imported by InspectionWorkspace.tsx and needs this.
