// noinspection JSUnusedGlobalSymbols
export const base_kvin: KVIN;

export default base_kvin;

interface UnknownConstructor {
    new (...args: unknown[]): unknown;
}

export class KVIN {
    /**
     * @constructor to create an alternate KVIN context. This allows us to recognize instance of
     *              the standard classes from a different JS context or have different tuning parameters.
     * @param ctors list or object of standard constructors
     */
    constructor(ctors: UnknownConstructor);

    /**
     * Built-in objects that we know how to serialize.
     * @type {Record<string, UnknownConstructor>}
     */
    standardObjects: Record<string, UnknownConstructor>;

    /**
     * List of constructors that we know how to serialize.
     * @type {UnknownConstructor[]}
     */
    ctors: UnknownConstructor[];

    /**
     * When true allows Kvin to deserialize Functions.
     * @type {boolean}
     */
    makeFunctions: boolean;

    /**
     * When to start trying to use islands-of-zeros encoding;
     * bigger numbers mean faster encoding/decoding but longer strings.
     * @default 8
     * @type {number}
     */
    typedArrayPackThreshold: number;

    /**
     * When to start trying to use sparse-array representation for Arrays;
     * bigger numbers mean faster encoding/decoding but longer strings.
     * @default 8
     * @type {number}
     */
    scanArrayThreshold: number;

    /**
     * Dictionary; keys are constructor names, values are constructor
     * functions for user-defined classes
     * @type {Record<string, UnknownConstructor>}
     */
    userCtors: Record<string, UnknownConstructor>;

    /**
     * Take a 'prepared object' (which can be represented by JSON) and turn it
     * into an object which resembles the object it was created from.
     *
     * *  @deprecated Internal, do not use if possible.
     *
     * @param seen An array objects we have already seen in this
     * object graph; used to track cycles.
     * @param po A prepared object representing a value or a primitive
     * @param position A string representing our position within
     * the graph. Used only for error messages.
     * @returns unknown the value encoded by po
     */
    unprepare(seen: Array<unknown>, po: unknown, position: string): unknown;

    /**
     * Take an arbitrary object and turn it into a 'prepared object'.
     * A prepared object can always be represented with JSON.
     *
     * @deprecated Internal, do not use if possible.
     *
     * @param seen An array objects we have already seen in this
     * object graph; used to track cycles.
     * @param o The object that the prepared object reflects
     * @param where Undocumented option
     * @returns unknown A prepared object
     */
    prepare(seen: Array<unknown>, o: unknown, where: unknown): unknown;

    /**
     * Prepare a value for serialization.
     *
     * Like {@link serialize}, but returns a JSON-compatible object instead of a string.
     *
     * @param what any (supported) JS value
     * @returns an object which can be serialized with json
     */
    marshal(what: unknown): {
        _serializeVerId: typeof serializeVerId;
        what: unknown;
    };

    /**
     * Prepare a value that is a Promise or contains a Promise for serialization.
     *
     * Removes cycles in objects to enable stringification using `JSON.stringify`.
     *
     * Like {@link serializeAsync}, but returns a promise to a JSON-compatible
     * object instead of a string.
     *
     * @param value A supported JS value that can be marshalled
     * @param isRecursing Whether this is a recursive call
     * @returns Promise<object> An object which can be serialized with
     * `JSON.stringify`
     */
    marshalAsync(value: unknown, isRecursing?: boolean): Promise<object>;

    /**
     * Turn a marshaled (prepared) value back into its original form
     *
     * Like {@link deserialize}, but takes a marshaled object instead of a string.
     * @param obj a prepared object - the output of this.marshal()
     * @returns object an object resembling the object originally passed to this.marshal()
     */
    unmarshal(obj: unknown): unknown;

    /**
     * Serialize a value.
     * @param what The value to serialize
     * @returns The JSON serialization of the prepared object representing what.
     */
    serialize(what: unknown): string;

    /**
     * Serialize a value that is a Promise or contains Promises.
     *
     * Any Promises encountered while traversing the object graph (argument) will be awaited,
     * and their resolved values will be serialized. Deserialization will generate Promises
     * which resolve to these values.
     *
     * @param value The value to serialize
     * @returns {Promise<string>} A JSON serialization representing the value
     */
    serializeAsync(value: unknown): Promise<string>;

    /**
     * Deserialize a value.
     * @param str The JSON serialization of the prepared object representing the value.
     * @returns unknown The deserialized value
     */
    deserialize(str: string): unknown;

    /**
     * Version identifier for the serialization format.
     * @type {'v8'}
     */
    serializeVerId: 'v8';
    parse = this.deserialize;
    stringify = this.serialize;
    stringifyAsync = this.serializeAsync;
}
