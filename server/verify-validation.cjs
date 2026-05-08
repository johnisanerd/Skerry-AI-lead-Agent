#!/usr/bin/env node
/**
 * Improved CI Gate: Verify all API routes have validate() middleware
 * Run with: node server/verify-validation.cjs
 */

const fs = require('fs');
const path = require('path');

function extractRoutesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes = [];
  
  // Better regex to match route definitions - handles multi-line
  const routeRegex = /(app|router)\.(get|post|put|patch|delete)\s*\(/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(routeRegex);
    
    if (match) {
      const method = match[2].toUpperCase();
      
      // Extract path - might be on same line or next line(s)
      let pathLine = line;
      let pathMatch = pathLine.match(/["']([^"']+)["']/);
      
      // If not found on same line, check next lines
      if (!pathMatch) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          pathMatch = lines[j].match(/["']([^"']+)["']/);
          if (pathMatch) break;
        }
      }
      
      if (!pathMatch) continue;
      
      const routePath = pathMatch[1];
      
      // Look ahead for validate() in the middleware chain
      let hasValidate = false;
      let hasBodyValidation = false;
      let hasQueryValidation = false;
      let hasParamValidation = false;
      
      // Check up to 20 lines ahead for validate
      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        const checkLine = lines[j];
        
        if (checkLine.includes('validate(')) {
          hasValidate = true;
          
          // Check what type of validation
          if (checkLine.includes('body:')) hasBodyValidation = true;
          if (checkLine.includes('query:')) hasQueryValidation = true;
          if (checkLine.includes('params:')) hasParamValidation = true;
          
          // Check multi-line validate calls
          if (checkLine.includes('validate({')) {
            for (let k = j; k < Math.min(j + 15, lines.length); k++) {
              const futureLine = lines[k];
              if (futureLine.includes('body:')) hasBodyValidation = true;
              if (futureLine.includes('query:')) hasQueryValidation = true;
              if (futureLine.includes('params:')) hasParamValidation = true;
              if (futureLine.includes('})')) break;
            }
          }
        }
        
        // Stop if we hit the handler
        if (checkLine.includes('asyncHandler') || 
            checkLine.includes('(req, res)') ||
            checkLine.includes('(req,res)') ||
            (checkLine.includes(') =>') && checkLine.includes('{'))) {
          break;
        }
      }
      
      routes.push({
        method,
        path: routePath,
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

function main() {
  const indexPath = path.join(__dirname, 'index.ts');
  const routes = extractRoutesFromFile(indexPath);
  
  const errors = [];
  const warnings = [];
  
  console.log('\n🔍 Checking API route validation coverage...\n');
  console.log(`Found ${routes.length} routes to check.\n`);
  
  // Check POST routes
  const postRoutes = routes.filter(r => r.method === 'POST');
  console.log(`📝 POST routes: ${postRoutes.length}`);
  postRoutes.forEach(r => {
    const status = r.hasValidate ? '✅' : '❌';
    console.log(`  ${status} ${r.method} ${r.path} (line ${r.lineNumber})`);
    if (!r.hasValidate) {
      errors.push(`POST ${r.path} (line ${r.lineNumber}) - Missing validate() middleware`);
    }
  });
  
  // Check PUT routes
  const putRoutes = routes.filter(r => r.method === 'PUT');
  console.log(`\n✏️  PUT routes: ${putRoutes.length}`);
  putRoutes.forEach(r => {
    const status = r.hasValidate ? '✅' : '❌';
    console.log(`  ${status} ${r.method} ${r.path} (line ${r.lineNumber})`);
    if (!r.hasValidate) {
      errors.push(`PUT ${r.path} (line ${r.lineNumber}) - Missing validate() middleware`);
    }
  });
  
  // Check DELETE routes
  const deleteRoutes = routes.filter(r => r.method === 'DELETE');
  console.log(`\n🗑️  DELETE routes: ${deleteRoutes.length}`);
  deleteRoutes.forEach(r => {
    const status = r.hasValidate ? '✅' : '❌';
    console.log(`  ${status} ${r.method} ${r.path} (line ${r.lineNumber})`);
    if (!r.hasValidate) {
      errors.push(`DELETE ${r.path} (line ${r.lineNumber}) - Missing validate() middleware`);
    }
  });
  
  // Check GET routes
  const getRoutes = routes.filter(r => r.method === 'GET');
  console.log(`\n🔍 GET routes: ${getRoutes.length}`);
  getRoutes.forEach(r => {
    const needsQueryValidation = r.path.includes('/leads') ||
                              r.path.includes('/sequences') ||
                              r.path.includes('/audit') ||
                              r.path.includes('/workspaces') ||
                              r.path.includes('/ab-tests') ||
                              r.path.includes('/export') ||
                              r.path.includes('/health');
    const status = (needsQueryValidation && !r.hasQueryValidation) ? '⚠️ ' : '✅';
    console.log(`  ${status} ${r.method} ${r.path} (line ${r.lineNumber})`);
    if (needsQueryValidation && !r.hasQueryValidation) {
      warnings.push(`GET ${r.path} (line ${r.lineNumber}) - Consider adding query validation`);
    }
  });
  
  // Check routes with :id params
  const routesWithParams = routes.filter(r => r.path.includes(':'));
  console.log(`\n🔑 Routes with params: ${routesWithParams.length}`);
  routesWithParams.forEach(r => {
    const status = r.hasParamValidation ? '✅' : '❌';
    console.log(`  ${status} ${r.method} ${r.path} (line ${r.lineNumber})`);
    if (!r.hasParamValidation) {
      errors.push(`${r.method} ${r.path} (line ${r.lineNumber}) - Missing param validation for :id`);
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  
  if (errors.length > 0) {
    console.error('\n❌ OWASP A03 VALIDATION ERRORS:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\n⚠️  Please add validate() middleware to all routes!\n');
  }
  
  if (warnings.length > 0) {
    console.warn('\n⚠️  WARNINGS (consider fixing):\n');
    warnings.forEach(warn => console.warn(`  - ${warn}`));
    console.warn('');
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All routes have proper validation middleware!\n');
  } else if (errors.length === 0) {
    console.log('\n✅ No critical errors. Consider addressing warnings.\n');
  }
  
  console.log('='.repeat(60) + '\n');
  
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
