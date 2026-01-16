import type { JSONSchema7 } from '@internal/ai-sdk-v5';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import {
  isStandardSchemaWithJSON,
  type StandardSchemaWithJSON,
  type InferStandardSchemaOutput,
} from '../../schema/schema';
import type { ZodLikeSchema } from '../../types/zod-compat';

/**
 * @deprecated Use StandardSchemaWithJSON from '../../schema/schema' instead
 */
export type OutputSchema<OBJECT = any> = StandardSchemaWithJSON<OBJECT> | undefined;

export type PartialSchemaOutput<OUTPUT = undefined> = OUTPUT extends undefined ? undefined : Partial<OUTPUT>;

export type InferSchemaOutput<OUTPUT extends StandardSchemaWithJSON | undefined> = OUTPUT extends undefined
  ? undefined
  : OUTPUT extends StandardSchemaWithJSON
    ? InferStandardSchemaOutput<OUTPUT>
    : unknown;

export type InferZodLikeSchema<T> = T extends { parse: (data: unknown) => infer U } ? U : any;
export type SchemaWithValidation<OBJECT = any> = ZodLikeSchema<OBJECT>;

export type ZodLikePartialSchema<T = any> = (
  | z4.core.$ZodType<Partial<T>, any> // Zod v4 partial schema
  | z3.ZodType<Partial<T>, z3.ZodTypeDef, any> // Zod v3 partial schema
) & {
  safeParse(value: unknown): { success: boolean; data?: Partial<T>; error?: any };
};

export function asJsonSchema(schema: StandardSchemaWithJSON | undefined): JSONSchema7 | undefined {
  if (!schema) {
    return undefined;
  }

  // Handle StandardSchemaWithJSON
  if (isStandardSchemaWithJSON(schema)) {
    return schema['~standard'].jsonSchema.output({ target: 'draft-07' }) as JSONSchema7;
  }

  return undefined;
}

export function getTransformedSchema<OUTPUT = undefined>(schema?: StandardSchemaWithJSON<OUTPUT>) {
  const jsonSchema = asJsonSchema(schema);

  if (!jsonSchema) {
    return undefined;
  }

  const { $schema, ...itemSchema } = jsonSchema;
  if (itemSchema.type === 'array') {
    const innerElement = itemSchema.items;
    const arrayOutputSchema: JSONSchema7 = {
      $schema: $schema,
      type: 'object',
      properties: {
        elements: { type: 'array', items: innerElement },
      },
      required: ['elements'],
      additionalProperties: false,
    };

    return {
      jsonSchema: arrayOutputSchema,
      outputFormat: 'array',
    };
  }

  // Handle enum schemas - wrap in object like AI SDK does
  if (itemSchema.enum && Array.isArray(itemSchema.enum)) {
    const enumOutputSchema: JSONSchema7 = {
      $schema: $schema,
      type: 'object',
      properties: {
        result: { type: itemSchema.type || 'string', enum: itemSchema.enum },
      },
      required: ['result'],
      additionalProperties: false,
    };

    return {
      jsonSchema: enumOutputSchema,
      outputFormat: 'enum',
    };
  }

  return {
    jsonSchema: jsonSchema,
    outputFormat: jsonSchema.type, // 'object'
  };
}

export function getResponseFormat(schema?: StandardSchemaWithJSON):
  | {
      type: 'text';
    }
  | {
      type: 'json';
      /**
       * JSON schema that the generated output should conform to.
       */
      schema?: JSONSchema7;
    } {
  if (schema) {
    const transformedSchema = getTransformedSchema(schema);
    return {
      type: 'json',
      schema: transformedSchema?.jsonSchema,
    };
  }

  // response format 'text' for everything else
  return {
    type: 'text',
  };
}
