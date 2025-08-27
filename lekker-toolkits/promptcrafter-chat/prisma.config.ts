// Explicit Prisma config to replace deprecated package.json#prisma field
// Keeps schema path stable for build scripts (they pass --schema anyway).
export default {
  schema: 'prisma/schema.sqlite.prisma',
};
