<script lang="ts">
    import type { Snippet } from 'svelte';
    import { FitTitle, GalleryCard, KeyValueList, scrollHint, type KeyValue } from '../ui';

    let {
        src,
        alt = '',
        title,
        label = title,
        labelFit = null,
        subtitle = '',
        facts = [],
        description = '',
        html = false,
        cols = [],
        fit = 'cover',
        selected = false,
        selectable = false,
        selecting = false,
        checked = false,
        onclick,
        oncheck,
        ontileclick,
        oncontextmenu,
        ontitleclick,
        overlay,
        extra,
        actions,
        detail,
        placeholder,
    }: {
        src: string;
        alt?: string;
        title: string;
        label?: string;
        labelFit?: { width: number; lines: number } | null;
        subtitle?: string;
        facts?: KeyValue[];
        description?: string;
        html?: boolean;
        cols?: string[];
        fit?: 'cover' | 'contain';
        selected?: boolean;
        selectable?: boolean;
        selecting?: boolean;
        checked?: boolean;
        onclick?: (e: MouseEvent) => void;
        oncheck?: (checked: boolean, e: MouseEvent) => void;
        ontileclick?: (e: MouseEvent) => void;
        oncontextmenu?: (e: MouseEvent) => void;
        ontitleclick?: (e: MouseEvent) => void;
        overlay?: Snippet;
        extra?: Snippet;
        actions?: Snippet;
        /** details List cells (instead of the plain `cols` strings) */
        detail?: Snippet;
        placeholder?: string;
    } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (list rows: a pointer shortcut, the card button is the keyboard target) -->
<div class="tile" role="group" aria-label={title} onclick={ontileclick} {oncontextmenu}>
    <GalleryCard {src} {alt} {fit} {placeholder} cache {selected} {selectable} {selecting} {checked} {onclick} {oncheck} />
    {#snippet name()}{#if labelFit}<FitTitle text={label} width={labelFit.width} lines={labelFit.lines} sizes={labelFit.lines > 1 ? [12, 11, 10] : [11, 10]} />{:else}{label}{/if}{/snippet}
    {#if ontitleclick}<button type="button" class="fname tbtn" onclick={ontitleclick}><span class="ft">{@render name()}</span></button>
    {:else}<span class="fname"><span class="ft">{@render name()}</span></span>{/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (focusable so the details can be scrolled with the keyboard) -->
    <div class="desc" tabindex="0" use:scrollHint>
        {#if ontitleclick}<button type="button" class="head tbtn" onclick={ontitleclick}>{title}</button>{:else}<div class="head">{title}</div>{/if}
        {#if subtitle}<div class="sub">{subtitle}</div>{/if}
        {#if extra}<div class="extra">{@render extra()}</div>{/if}
        {#if facts.length}<KeyValueList label="Details" items={facts} inline />{/if}
        {#if description}<div class="blurb">{#if html}{@html description}{:else}{description}{/if}</div>{/if}
    </div>
    {#if actions}<div class="acts">{@render actions()}</div>{/if}
    {#if detail}<span class="cols">{@render detail()}</span>
    {:else if cols.length}<span class="cols">{#each cols as c, i (i)}<span>{c}</span>{/each}</span>{/if}
    {#if overlay}<div class="info">{@render overlay()}</div>{/if}
</div>
