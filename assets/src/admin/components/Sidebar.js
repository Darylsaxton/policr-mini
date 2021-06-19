import React, { useCallback, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation, Link as RouteLink } from "react-router-dom";
import tw, { styled } from "twin.macro";
import MoonLoader from "react-spinners/MoonLoader";
import Switch from "react-switch";
import useSWR from "swr";

import {
  camelizeJson,
  toastErrors,
  updateInNewArray,
  isSysLink,
} from "../helper";
import { loadSelected, receiveChats } from "../slices/chats";

const NavItemLink = styled(RouteLink)`
  ${tw`py-3 px-6 no-underline text-black tracking-wider`}
  ${tw`hover:bg-blue-100 hover:text-blue-500`}
  ${tw`border-0 border-l-2 border-r-2 border-solid border-transparent`}
  ${({ selected = false }) => selected && tw`text-blue-500 border-current`}
  ${({ ending = ending }) => ending && tw`rounded-b`}
  border-right-color: transparent;
`;

const NavItem = ({
  title: title,
  href: href,
  selected: selected,
  ending: ending,
}) => {
  return (
    <NavItemLink to={href} selected={selected} ending={ending}>
      <span tw="xl:text-lg">{title}</span>
    </NavItemLink>
  );
};

function isSelect(page, path) {
  const re = new RegExp(`^/admin/chats/-\\d+/${page}`);

  return re.test(path);
}

const Loading = () => {
  return (
    <div tw="flex justify-center my-6">
      <MoonLoader size={25} color="#47A8D8" />
    </div>
  );
};

const MenuBox = ({
  visibility = true,
  isLoaded = true,
  title,
  miniTitle,
  children,
}) => {
  if (!visibility) return null;

  return (
    <div tw="flex flex-col bg-gray-100 rounded-lg mx-4 my-2 shadow">
      <div tw="p-3 border border-solid border-0 border-b border-gray-200">
        <span tw="hidden lg:inline text-xl text-black">{title}</span>
        <span tw="lg:hidden block text-center text-xl text-black">
          {miniTitle}
        </span>
      </div>
      {isLoaded ? <>{children}</> : <Loading />}
    </div>
  );
};

const changeTakeover = async ({ chatId, isTakeOver }) => {
  const endpoint = `/admin/api/chats/${chatId}/takeover?value=${isTakeOver}`;
  return fetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((r) => camelizeJson(r));
};

const makeTodayStatisticsEndpoint = (chat_id, status) =>
  `/admin/api/statistics/find_today?chat_id=${chat_id}&status=${status}`;

export default () => {
  const location = useLocation();
  const dispatch = useDispatch();

  const chatsState = useSelector((state) => state.chats);

  const { data: todayStatisticsData, error } = useSWR(
    chatsState && chatsState.isLoaded && chatsState.selected
      ? makeTodayStatisticsEndpoint(chatsState.selected)
      : null
  );

  const [isTakeOver, setIsTakeOver] = useState(false);
  const [isOnOwnerMenu, setIsOnOwnerMenu] = useState(
    isSysLink({ path: location.pathname })
  );

  const handleTakeOverChange = useCallback(
    (checked) => {
      setIsTakeOver(checked);
      changeTakeover({
        chatId: chatsState.selected,
        isTakeOver: checked,
      }).then((result) => {
        if (result.errors) {
          toastErrors(result.errors);
          setIsTakeOver(!checked);
        } else {
          // 更新 chats 状态中的 `loadedSelected` 和 `list` 数据。
          if (result.chat.id == chatsState.selected) {
            dispatch(loadSelected(result.chat));
          }

          const dirtyIndex = chatsState.list.findIndex(
            (c) => c.id === result.chat.id
          );
          if (dirtyIndex > -1) {
            const newList = updateInNewArray(
              chatsState.list,
              result.chat,
              dirtyIndex
            );
            dispatch(receiveChats(newList));
          }
        }
      });
    },
    [chatsState]
  );

  useEffect(() => {
    if (chatsState.loadedSelected)
      setIsTakeOver(chatsState.loadedSelected.isTakeOver);
  }, [chatsState]);

  useEffect(() => {
    setIsOnOwnerMenu(isSysLink({ path: location.pathname }));
  }, [location]);

  return (
    <nav>
      <MenuBox
        isLoaded={chatsState.isLoaded}
        title="管理员菜单"
        miniTitle="菜单"
      >
        {/* <NavItem
          title="数据统计"
          href={`/admin/chats/${chatsState.selected}/statistics`}
          selected={isSelect("statistics", location.pathname)}
        /> */}
        <NavItem
          title="方案定制"
          href={`/admin/chats/${chatsState.selected}/scheme`}
          selected={isSelect("scheme", location.pathname)}
        />
        {/* <NavItem
          title="消息模板"
          href={`/admin/chats/${chatsState.selected}/template`}
          selected={isSelect("template", location.pathname)}
        /> */}
        <NavItem
          title="验证记录"
          href={`/admin/chats/${chatsState.selected}/verifications`}
          selected={isSelect("verifications", location.pathname)}
        />
        <NavItem
          title="操作记录"
          href={`/admin/chats/${chatsState.selected}/operations`}
          selected={isSelect("operations", location.pathname)}
        />
        <NavItem
          title="管理员权限"
          href={`/admin/chats/${chatsState.selected}/permissions`}
          selected={isSelect("permissions", location.pathname)}
        />
        {/* <NavItem
          title="机器人属性"
          href={`/admin/chats/${chatsState.selected}/properties`}
          selected={isSelect("properties", location.pathname)}
        /> */}
        <NavItem
          title="自定义"
          href={`/admin/chats/${chatsState.selected}/custom`}
          selected={isSelect("custom", location.pathname)}
          ending={isOnOwnerMenu ? "true" : "false"}
        />
        {chatsState.loadedSelected && !isOnOwnerMenu ? (
          <>
            {/*因为菜单链接有一个宽度为 2px 的左右边框，此处需要增加对应宽度的外边距以保持对齐。*/}
            <div tw="pt-3 px-6" style={{ marginLeft: 2, marginRight: 2 }}>
              <span tw="xl:text-lg text-gray-600">数据统计</span>
              <div tw="flex items-center justify-between">
                <div tw="flex flex-col items-center">
                  <span tw="text-xs lg:text-sm text-gray-500 mt-2">
                    今日验证通过
                  </span>
                  <span tw="text-sm text-green-700 font-bold mt-1 tracking-wide">
                    {todayStatisticsData == undefined
                      ? "计算中"
                      : todayStatisticsData.passedStatistic
                      ? todayStatisticsData.passedStatistic.verificationsCount
                      : 0}
                  </span>
                </div>
                <div tw="bg-gray-300 h-10" style={{ width: 1 }}></div>
                <div tw="flex flex-col items-center">
                  <span tw="text-xs lg:text-sm text-gray-500 mt-2">
                    今日验证失败
                  </span>
                  <span tw="text-sm text-red-700 font-bold mt-1 tracking-wider">
                    {todayStatisticsData == undefined
                      ? "计算中"
                      : (todayStatisticsData.timeoutStatistic
                          ? todayStatisticsData.timeoutStatistic
                              .verificationsCount
                          : 0) +
                        (todayStatisticsData.wrongedStatistic
                          ? todayStatisticsData.wrongedStatistic
                              .verificationsCount
                          : 0)}
                  </span>
                </div>
              </div>
            </div>
            <div
              tw="py-3 px-6 text-lg text-gray-600 flex justify-between"
              style={{ marginLeft: 2, marginRight: 2 }}
            >
              <span>
                {chatsState.loadedSelected.isTakeOver ? "已接管" : "未接管"}
              </span>
              <Switch
                checked={isTakeOver}
                checkedIcon={false}
                uncheckedIcon={false}
                onChange={handleTakeOverChange}
              />
            </div>
          </>
        ) : !isOnOwnerMenu ? (
          <div tw="py-3 px-6 text-lg text-gray-600 flex justify-between">
            <span>检查中…</span>
          </div>
        ) : null}
      </MenuBox>

      <MenuBox visibility={_GLOBAL.isOwner} title="系统菜单" miniTitle="系统">
        <NavItem
          title="批量管理"
          href="/admin/sys/managements"
          selected={isSysLink({ path: location.pathname, page: "managements" })}
        />
        <NavItem
          title="查阅日志"
          href="/admin/sys/logs"
          selected={isSysLink({ path: location.pathname, page: "logs" })}
        />
        {/* <NavItem
          title="定时任务"
          href="/admin/sys/tasks"
          selected={isSysLink({ path: location.pathname, page: "tasks" })}
        /> */}
        {/* <NavItem
          title="使用条款"
          href="/admin/sys/terms"
          selected={isSysLink({ path: location.pathname, page: "terms" })}
          ending="true"
        /> */}
        {/* <NavItem
          title="模拟终端"
          href="/admin/sys/terminal"
          selected={isSysLink({ path: location.pathname, page: "terminal" })}
        /> */}
      </MenuBox>
    </nav>
  );
};
