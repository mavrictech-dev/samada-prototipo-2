export const permissionGroups: Record<string, string[]> = {
  products: ["read", "create", "update", "delete", "publish", "export"],
  taxonomy: ["read", "create", "update", "delete"],
  pages: ["read", "create", "update", "delete", "publish"],
  imports: ["read", "template", "upload", "execute", "cancel"],
  media: ["read", "upload", "link", "replace", "delete"],
  users: ["read", "create", "update", "delete", "roles", "sessions"],
  roles: ["read", "create", "update", "delete"],
  permissions: ["read", "create", "update", "delete"],
  settings: ["read", "update"], audit: ["read"],
};
export const permissionKeys = Object.entries(permissionGroups).flatMap(([resource, actions]) => actions.map(action => `${resource}.${action}`));
export const permissionLabels: Record<string,string> = {products:"Productos",taxonomy:"Marcas, categorías y tamaños",pages:"Páginas y distribución",imports:"Importaciones",media:"Imágenes",users:"Usuarios",roles:"Roles",permissions:"Permisos",settings:"Configuración",audit:"Auditoría"};
