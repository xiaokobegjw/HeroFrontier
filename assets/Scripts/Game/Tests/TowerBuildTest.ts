/**
 * 塔防建造逻辑单元测试 (模拟)
 * 验证 TowerBuildUI 的核心交互流程
 */
export class TowerBuildTest {
    public static runTests(ui: any, currency: any, towerManager: any) {
        console.log('--- Starting Tower Build Tests ---');

        // 1. 测试初始状态
        ui.hideAll();
        console.assert(ui.towerSelectNode.active === false, 'Initial state: TowerSelectNode should be hidden');
        console.assert(ui.towerAttackRange.active === false, 'Initial state: TowerAttackRange should be hidden');

        // 2. 测试点击空槽位显示面板
        const mockPos = { x: 100, y: 100 };
        ui.showBuildMenu(0, mockPos);
        console.assert(ui.towerSelectNode.active === true, 'Click slot: TowerSelectNode should show');
        console.assert(ui.towerAttackRange.active === true, 'Click slot: TowerAttackRange should show');
        console.assert(ui.towerAttackRange.scale.x === 0, 'Click slot: Initial range scale should be 0');

        // 3. 测试资源不足拦截
        currency.gold = 10; // 设为极低
        ui.onBtnSelectArrowClicked();
        console.assert(ui.currentSelectedTowerType === null, 'Resource check: Should not select tower if gold insufficient');
        console.assert(ui.iconSelectArrowTowerBG.active === false, 'Resource check: Confirm BG should be hidden');

        // 4. 测试首次点击选中 (资源充足)
        currency.gold = 500;
        ui.onBtnSelectArrowClicked();
        console.assert(ui.currentSelectedTowerType === 'Arrow', 'First click: Should select Arrow tower');
        console.assert(ui.iconSelectArrowTowerBG.active === true, 'First click: Should show Arrow confirm BG');
        console.assert(ui.towerAttackRange.scale.x > 0, 'First click: Range scale should be updated');

        // 5. 测试多塔类型切换互斥
        ui.onBtnSelectMagicClicked();
        console.assert(ui.currentSelectedTowerType === 'Magic', 'Switch: Should select Magic tower');
        console.assert(ui.iconSelectMagicTowerBG.active === true, 'Switch: Should show Magic confirm BG');
        console.assert(ui.iconSelectArrowTowerBG.active === false, 'Switch: Should hide Arrow confirm BG (Mutual exclusion)');

        // 6. 测试二次点击确认建造
        const initialGold = currency.gold;
        ui.onBtnSelectMagicClicked(); // 二次点击 Magic
        // 注意：performBuild 是异步的，实际测试需 await
        setTimeout(() => {
            console.assert(currency.gold < initialGold, 'Second click: Gold should be deducted');
            console.assert(ui.towerSelectNode.active === false, 'Second click: UI should be hidden after build');
            console.assert(ui.towerAttackRange.active === false, 'Second click: Range preview should be hidden');
            console.log('--- Tower Build Tests Completed Successfully ---');
        }, 100);
    }
}
