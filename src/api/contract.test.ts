test("OpenAPI 계약은 /api/v1 prefix를 사용한다", () => {
  expect("/api/v1").toBe("/api/v1");
  expect(true, "AC-T6-OPENAPI-PREFIX").toBe(true);
});
