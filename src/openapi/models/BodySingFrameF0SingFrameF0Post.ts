/* tslint:disable */
/* eslint-disable */
/**
 * VOICEVOX ENGINE OSS
 * VOICEVOX OSS の音声合成エンジンです。
 *
 * The version of the OpenAPI document: latest
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
import type { FrameAudioQuery } from './FrameAudioQuery';
import {
    FrameAudioQueryFromJSON,
    FrameAudioQueryFromJSONTyped,
    FrameAudioQueryToJSON,
} from './FrameAudioQuery';
import type { Score } from './Score';
import {
    ScoreFromJSON,
    ScoreFromJSONTyped,
    ScoreToJSON,
} from './Score';

/**
 * 
 * @export
 * @interface BodySingFrameF0SingFrameF0Post
 */
export interface BodySingFrameF0SingFrameF0Post {
    /**
     * 
     * @type {Score}
     * @memberof BodySingFrameF0SingFrameF0Post
     */
    score: Score;
    /**
     * 
     * @type {FrameAudioQuery}
     * @memberof BodySingFrameF0SingFrameF0Post
     */
    frameAudioQuery: FrameAudioQuery;
}

/**
 * Check if a given object implements the BodySingFrameF0SingFrameF0Post interface.
 */
export function instanceOfBodySingFrameF0SingFrameF0Post(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "score" in value;
    isInstance = isInstance && "frameAudioQuery" in value;

    return isInstance;
}

export function BodySingFrameF0SingFrameF0PostFromJSON(json: any): BodySingFrameF0SingFrameF0Post {
    return BodySingFrameF0SingFrameF0PostFromJSONTyped(json, false);
}

export function BodySingFrameF0SingFrameF0PostFromJSONTyped(json: any, ignoreDiscriminator: boolean): BodySingFrameF0SingFrameF0Post {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'score': ScoreFromJSON(json['score']),
        'frameAudioQuery': FrameAudioQueryFromJSON(json['frame_audio_query']),
    };
}

export function BodySingFrameF0SingFrameF0PostToJSON(value?: BodySingFrameF0SingFrameF0Post | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'score': ScoreToJSON(value.score),
        'frame_audio_query': FrameAudioQueryToJSON(value.frameAudioQuery),
    };
}

