defmodule PolicrMiniBot.Runner do
  @moduledoc """
  各个定时任务的具体实现模块。
  TODO: 执行任务时产生的 SSL 错误消息没有被 `SchedEx.Runner` 处理。可能需要修补上游问题或使用自己的 `Runner`。
  """

  alias PolicrMini.Logger

  alias PolicrMini.{VerificationBusiness, ChatBusiness, StatisticBusiness, PermissionBusiness}
  alias PolicrMini.Schema.Chat
  alias PolicrMiniBot.Helper, as: BotHelper

  @spec fix_expired_wait_status :: :ok
  @doc """
  修正所有过期的等待验证。
  """
  def fix_expired_wait_status do
    # 获取所有处于等待状态的验证
    verifications = VerificationBusiness.find_all_unity_waiting()
    # 计算已经过期的验证
    verifications =
      verifications
      |> Enum.filter(fn v ->
        remaining_seconds = DateTime.diff(DateTime.utc_now(), v.inserted_at)
        remaining_seconds - (v.seconds + 30) > 0
      end)

    # 修正状态
    # TODO: 待优化：在同一个事物中更新所有验证记录
    verifications
    |> Enum.each(fn verification ->
      # 自增统计数据（其它）。
      PolicrMiniBot.Helper.async do
        StatisticBusiness.increment_one(
          verification.chat_id,
          verification.target_user_language_code,
          :other
        )
      end

      verification |> VerificationBusiness.update(%{status: :expired})
    end)

    len = length(verifications)
    if len > 0, do: Logger.info("Automatically correct #{len} expired verifications")

    :ok
  end

  @spec check_working_status :: :ok
  @doc """
  根据权限自动修正工作状态或退出群组。
  """
  def check_working_status do
    ChatBusiness.find_takeovered() |> Enum.each(&handle_check_result/1)

    :ok
  end

  defp handle_check_result(%{id: chat_id, is_take_over: true, type: "group"}) do
    BotHelper.send_message(chat_id, BotHelper.t("errors.no_super_group"))

    Telegex.leave_chat(chat_id)
  end

  defp handle_check_result(%{id: chat_id, is_take_over: true, type: "channel"}),
    do: Telegex.leave_chat(chat_id)

  defp handle_check_result(%{is_take_over: true} = chat) do
    case Telegex.get_chat_member(chat.id, PolicrMiniBot.id()) do
      {:ok, member} ->
        # 检查权限并执行相应修正。

        # 如果不是管理员，取消接管
        unless member.status == "administrator", do: cancel_takeover(chat)
        # 如果没有限制用户权限，取消接管
        if member.can_restrict_members == false, do: cancel_takeover(chat)
        # 如果没有删除消息权限，取消接管
        if member.can_delete_messages == false, do: cancel_takeover(chat)
        # 如果没有发消息权限，直接退出
        if member.can_send_messages == false do
          Telegex.leave_chat(chat.id)
          Logger.info("Unable to send message in group `#{chat.id}`, has left automatically.")
        end

      {:error, error} ->
        handle_permission_check_error(error, chat)
    end
  end

  @error_description_bot_was_kicked "Forbidden: bot was kicked from the supergroup chat"
  @error_description_bot_is_not_member "Forbidden: bot is not a member of the supergroup chat"
  @error_description_chat_not_found "Bad Request: chat not found"

  # 机器人被封禁。
  # 取消接管。
  defp handle_permission_check_error(
         %Telegex.Model.Error{description: @error_description_bot_was_kicked},
         chat
       ),
       do: cancel_takeover(chat, false)

  # 机器人已不在群中。
  # 取消接管。
  defp handle_permission_check_error(
         %Telegex.Model.Error{description: @error_description_bot_is_not_member},
         chat
       ),
       do: cancel_takeover(chat, false)

  # 群组已不存在。
  # 取消接管，并删除与之相关的用户权限。
  defp handle_permission_check_error(
         %Telegex.Model.Error{description: @error_description_chat_not_found},
         chat
       ) do
    cancel_takeover(chat, false)
    PermissionBusiness.delete_all(chat.id)
  end

  # 未知错误
  defp handle_permission_check_error(%Telegex.Model.Error{} = e, chat),
    do: Logger.unitized_error("Bot permission check", chat_id: chat.id, error: e)

  @spec cancel_takeover(Chat.t(), boolean()) :: :ok
  # 取消接管
  defp cancel_takeover(%Chat{id: chat_id} = chat, send_notification \\ true)
       when is_integer(chat_id) and is_boolean(send_notification) do
    ChatBusiness.cancel_takeover(chat)

    if send_notification,
      do:
        BotHelper.async(fn ->
          BotHelper.send_message(
            chat.id,
            BotHelper.t("errors.no_permission", %{bot_username: PolicrMiniBot.username()}),
            parse_mode: nil
          )
        end)

    Logger.info(
      "No permission in the group `#{chat_id}`, the takeover has been automatically cancelled."
    )

    :ok
  end
end
