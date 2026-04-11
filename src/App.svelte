<script>
	import { onMount } from 'svelte';
	import { validateSencode } from '@sudoku/sencode';
	import { modal } from '@sudoku/stores/modal';
	import { createGameStore } from './stores/gameStore.js';
	import Board from './components/Board/index.svelte';
	import Controls from './components/Controls/index.svelte';
	import Header from './components/Header/index.svelte';
	import Modal from './components/Modal/index.svelte';

	// 初始化新的游戏 Store Adapter
	export let gameStore = createGameStore();//典型Svelte 3 风格

	// 监听游戏赢的状态
	gameStore.won.subscribe(won => {
		if (won) {
			gameStore.pause();
			modal.show('gameover');
		}
	});

	onMount(() => {
		let hash = location.hash;

		if (hash.startsWith('#')) {
			hash = hash.slice(1);
		}

		let sencode;
		if (validateSencode(hash)) {
			sencode = hash;
		}

		modal.show('welcome', { onHide: gameStore.resume, sencode });
	});
</script>

<!-- Timer, Menu, etc. -->
<header>
	<Header {gameStore} />
</header>

<!-- Sudoku Field -->
<section>
	<Board {gameStore} />
</section>

<!-- Keyboard -->
<footer>
	<Controls {gameStore} />
</footer>

<Modal {gameStore} />

<style global>
	@import "./styles/global.css";
</style>