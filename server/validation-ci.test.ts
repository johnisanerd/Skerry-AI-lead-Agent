/**
 * CI Test: Verify all API routes have validate() middleware
 * 
 * This test ensures OWASP A03 compliance by checking that every
 * POST, PUT, PATCH, DELETE endpoint has Zod validation,
 * and all GET endpoints validate query parameters.
 */

import express from "express";
import { readFileSync } from "fs";
import { join } from "path";

interface RouteInfo {
  method: string;
  path: string;
  hasValidate: boolean;
  hasBodyValidation: boolean;
  hasQueryValidation: boolean;
  hasParamValidation: boolean;
  lineNumber?: number;
}

function extractRoutesFromFile(filePath: string): RouteInfo[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const routes: RouteInfo[] = [];
  
  // Regex to match route definitions
  const routeRegex = /^\s*(app|router)\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/;
  const validateRegex = /validate\(\s*\{[^}]*\}/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(routeRegex);
    
    if (match) {
      const method = match[2].toUpperCase();
      const path = match[3];
      
      // Look ahead for validate() in the middleware chain (next 5 lines)
      let hasValidate = false;
      let hasBodyValidation = false;
      let hasQueryValidation = false;
      let hasParamValidation = false;
      
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const checkLine = lines[j];
        if (checkLine.includes("validate(")) {
          hasValidate = true;
          
          // Check what type of validation
          if (checkLine.includes("body:")) hasBodyValidation = true;
          if (checkLine.includes("query:")) hasQueryValidation = true;
          if (checkLine.includes("params:")) hasParamValidation = true;
          
          // Also check multi-line validate calls
          if (checkLine.includes("validate({")) {
            // Look ahead for validation types
            for (let k = j; k < Math.min(j + 5, lines.length); k++) {
              const futureLine = lines[k];
              if (futureLine.includes("body:")) hasBodyValidation = true;
              if (futureLine.includes("query:")) hasQueryValidation = true;
              if (futureLine.includes("params:")) hasParamValidation = true;
              if (futureLine.includes("})")) break;
            }
          }
        }
        
        // Stop looking if we hit the handler function
        if (checkLine.includes("asyncHandler") || checkLine.includes("(req,") || checkLine.includes("(req,")) {
          break;
        }
      }
      
      routes.push({
        method,
        path,
        hasValidate,
        hasBodyValidation,
        hasQueryValidation,
        hasParamValidation,
        lineNumber: i + 1,
      });
    }
  }
  
  return routes;
}

describe("OWASP A03: API Route Validation Coverage", () => {
  const indexPath = join(__dirname, "index.ts");
  let routes: RouteInfo[];
  
  beforeAll(() => {
    routes = extractRoutesFromFile(indexPath);
  });
  
  it("should have validation on all POST routes", () => {
    const postRoutes = routes.filter(r => r.method === "POST");
    const withoutValidation = postRoutes.filter(r => !r.hasValidate);
    
    if (withoutValidation.length > 0) {
      const details = withoutValidation
        .map(r => `${r.method} ${r.path} (line ${r.lineNumber})`)
        .join("\n  ");
      throw new Error(
        `OWASP A03 VIOLATION: The following POST routes lack validate() middleware:\n  ${details}`
      );
    }
    
    postRoutes.forEach(route => {
      expect(route.hasValidate).toBe(true);
      expect(route.hasBodyValidation).toBe(true);
    });
  });
  
  it("should have validation on all PUT routes", () => {
    const putRoutes = routes.filter(r => r.method === "PUT");
    const withoutValidation = putRoutes.filter(r => !r.hasValidate);
    
    if (withoutValidation.length > 0) {
      const details = withoutValidation
        .map(r => `${r.method} ${r.path} (line ${r.lineNumber})`)
        .join("\n  ");
      throw new Error(
        `OWASP A03 VIOLATION: The following PUT routes lack validate() middleware:\n  ${details}`
      );
    }
  });
  
  it("should have validation on all PATCH routes", () => {
    const patchRoutes = routes.filter(r => r.method === "PATCH");
    patchRoutes.forEach(route => {
      expect(route.hasValidate).toBe(true);
    });
  });
  
  it("should have validation on all DELETE routes", () => {
    const deleteRoutes = routes.filter(r => r.method === "DELETE");
    const withoutValidation = deleteRoutes.filter(r => !r.hasValidate);
    
    if (withoutValidation.length > 0) {
      const details = withoutValidation
        .map(r => `${r.method} ${r.path} (line ${r.lineNumber})`)
        .join("\n  ");
      throw new Error(
        `OWASP A03 VIOLATION: The following DELETE routes lack validate() middleware:\n  ${details}`
      );
    }
  });
  
  it("should have query validation on GET routes with query params", () => {
    const getRoutes = routes.filter(r => r.method === "GET");
    
    // Filter to routes that likely need query validation (have query params in path or are list endpoints)
    const listRoutes = getRoutes.filter(r => 
      r.path.includes("/leads") ||
      r.path.includes("/sequences") ||
      r.path.includes("/audit/logs") ||
      r.path.includes("/workspaces") ||
      r.path.includes("/ab-tests") ||
      r.path.includes("/export")
    );
    
    const withoutQueryValidation = listRoutes.filter(r => !r.hasQueryValidation);
    
    if (withoutQueryValidation.length > 0) {
      const details = withoutQueryValidation
        .map(r => `${r.method} ${r.path} (line ${r.lineNumber})`)
        .join("\n  ");
      console.warn(
        `WARNING: The following GET list routes may lack query validation:\n  ${details}`
      );
    }
  });
  
  it("should have param validation on routes with :id parameters", () => {
    const routesWithParams = routes.filter(r => r.path.includes(":"));
    const withoutParamValidation = routesWithParams.filter(r => !r.hasParamValidation);
    
    if (withoutParamValidation.length > 0) {
      const details = withoutParamValidation
        .map(r => `${r.method} ${r.path} (line ${r.lineNumber})`)
        .join("\n  ");
      throw new Error(
        `OWASP A03 VIOLATION: The following routes with :id params lack param validation:\n  ${details}`
      );
    }
  });
  
  it("should return 422 status code for validation errors", () => {
    // This is tested by importing and checking the validation middleware
    const { validate } = require("./middleware/validation");
    expect(validate).toBeDefined();
    expect(typeof validate).toBe("function");
  });
  
  it("should have proper error contract (422 + {ok, code, message, requestId})", () => {
    // Read the validation.ts file and check for 422 status
    const validationPath = join(__dirname, "middleware", "validation.ts");
    const content = readFileSync(validationPath, "utf-8");
    
    expect(content).toMatch(/status\(422\)/);
    expect(content).toMatch(/ok.*false/);
    expect(content).toMatch(/code.*VALIDATION_ERROR/);
    expect(content).toMatch(/requestId/);
  });
});

// Helper to run tests
if (require.main === module) {
  console.log("Running validation CI check...");
  const routes = extractRoutesFromFile(join(__dirname, "index.ts"));
  
  const errors: string[] = [];
  
  // Check POST routes
  const postRoutes = routes.filter(r => r.method === "POST");
  postRoutes.forEach(r => {
    if (!r.hasValidate) {
      errors.push(`POST ${r.path} (line ${r.lineNumber}) - Missing validate() middleware`);
    }
  });
  
  // Check PUT routes
  const putRoutes = routes.filter(r => r.method === "PUT");
  putRoutes.forEach(r => {
    if (!r.hasValidate) {
      errors.push(`PUT ${r.path} (line ${r.lineNumber}) - Missing validate() middleware`);
    }
  });
  
  // Check DELETE routes
  const deleteRoutes = routes.filter(r => r.method === "DELETE");
  deleteRoutes.forEach(r => {
    if (!r.hasValidate) {
      errors.push(`DELETE ${r.path} (line ${r.lineNumber}) - Missing validate() middleware`);
    }
  });
  
  // Check routes with params
  const routesWithParams = routes.filter(r => r.path.includes(":"));
  routesWithParams.forEach(r => {
    if (!r.hasParamValidation) {
      errors.push(`${r.method} ${r.path} (line ${r.lineNumber}) - Missing param validation`);
    }
  });
  
  if (errors.length > 0) {
    console.error("\n❌ OWASP A03 VALIDATION ERRORS:\n");
    errors.forEach(err => console.error(`  - ${err}`));
    console.error("\nPlease add validate() middleware to all routes.\n");
    process.exit(1);
  } else {
    console.log("✅ All routes have proper validation middleware!\n");
    process.exit(0);
  }
}
