/**
 * Case Study Services
 *
 * Services for Case Study DWG generation including XREF placement
 * and Google Drive output.
 *
 * @module
 */

export {
  XrefScriptGenerator,
  getFilename,
  type XrefPlacement,
  type XrefScriptOptions,
} from './xref-script-generator'

export {
  XrefGeneratorService,
  getXrefGeneratorService,
  type GenerateXrefRequest,
  type GenerateXrefResult,
} from './xref-generator-service'
